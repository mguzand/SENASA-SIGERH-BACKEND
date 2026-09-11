import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { VacationMovementType, VacationPeriodStatus } from 'src/common/enums/vacation.enums';
import { EmployeeGovernmentVacationExclusion } from '../employee-government-vacation-exclusion/entities/employee-government-vacation-exclusion.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { Employee } from '../employees/entities/employee.entity';
import { VacationMovementService } from '../vacation-movement/vacation-movement.service';
import { VacationMovement } from '../vacation-movement/entities/vacation-movement.entity';
import { CreateGovernmentVacationDayDto } from './dto/create-government-vacation-day.dto';
import { GovernmentVacationDay } from './entities/government-vacation-day.entity';

@Injectable()
export class GovernmentVacationDayService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GovernmentVacationDay)
    private readonly dayRepository: Repository<GovernmentVacationDay>,
    private readonly movementService: VacationMovementService,
  ) {}

  async findAll() {
    const days = await this.dayRepository.find({
      where: { isActive: true },
      order: { date: 'ASC', created_at: 'ASC' },
    });
    const exclusions = days.length ? await this.dataSource
      .getRepository(EmployeeGovernmentVacationExclusion)
      .find({ where: days.map((day) => ({ governmentVacationDayId: day.id })) }) : [];
    return days.map((day) => ({
      ...day,
      kind: 'GOVERNMENT_VACATION' as const,
      excludedEmployeeIds: exclusions
        .filter((item) => item.governmentVacationDayId === day.id)
        .map((item) => item.employeeId),
    }));
  }

  findExclusions(governmentVacationDayId: string) {
    return this.dataSource.getRepository(EmployeeGovernmentVacationExclusion).find({
      where: { governmentVacationDayId },
      relations: { employee: true },
      order: { created_at: 'ASC' },
    });
  }

  async createAndProcess(dto: CreateGovernmentVacationDayDto, createdByUserId: string | null) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const duplicate = await runner.manager.findOne(GovernmentVacationDay, {
        where: { date: dto.date, isActive: true },
      });
      if (duplicate) throw new ConflictException('Ya existe un asueto de Gobierno activo en esa fecha.');

      const excludedIds = [...new Set(dto.excludedEmployeeIds || [])];
      if (excludedIds.length) {
        const activeExcluded = await runner.manager.createQueryBuilder(Employee, 'employee')
          .select('employee.id', 'id').where('employee.id IN (:...ids)', { ids: excludedIds })
          .andWhere('employee.status = :status', { status: 'ACTIVE' }).getRawMany<{ id: string }>();
        if (activeExcluded.length !== excludedIds.length) {
          throw new ConflictException('Una o más excepciones no corresponden a empleados activos.');
        }
      }

      let day = runner.manager.create(GovernmentVacationDay, {
        date: dto.date, title: dto.title.trim(), description: dto.description?.trim() || null,
        affectsVacationBalance: true, isActive: true, alreadyProcessed: false, createdByUserId,
        affectedEmployees: 0, excludedEmployees: excludedIds.length, skippedEmployees: 0,
      });
      day = await runner.manager.save(GovernmentVacationDay, day);

      if (excludedIds.length) {
        await runner.manager.save(EmployeeGovernmentVacationExclusion, excludedIds.map((employeeId) =>
          runner.manager.create(EmployeeGovernmentVacationExclusion, {
            employeeId, governmentVacationDayId: day.id,
            reason: 'Empleado exceptuado del asueto a cuenta de vacaciones.', createdByUserId,
          }),
        ));
      }

      const activeEmployees = await runner.manager.createQueryBuilder(Employee, 'employee')
        .select('employee.id', 'id').where('employee.status = :status', { status: 'ACTIVE' })
        .orderBy('employee.id', 'ASC').getRawMany<{ id: string }>();
      const excluded = new Set(excludedIds);
      let affected = 0;
      let skipped = 0;

      for (const employee of activeEmployees) {
        if (excluded.has(employee.id)) continue;
        if (await this.applyGovernmentDay(employee.id, day, createdByUserId, runner.manager)) affected++;
        else skipped++;
      }

      day.affectedEmployees = affected;
      day.skippedEmployees = skipped;
      day.alreadyProcessed = true;
      day = await runner.manager.save(GovernmentVacationDay, day);
      await runner.commitTransaction();
      return { ...day, kind: 'GOVERNMENT_VACATION' as const };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async updateExclusions(dayId: string, requestedIds: string[], createdByUserId: string | null) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const day = await runner.manager.findOne(GovernmentVacationDay, {
        where: { id: dayId, isActive: true }, lock: { mode: 'pessimistic_write' },
      });
      if (!day) throw new ConflictException('El asueto de Gobierno no existe.');
      const nextIds = [...new Set(requestedIds || [])];
      if (nextIds.length) {
        const valid = await runner.manager.createQueryBuilder(Employee, 'employee')
          .select('employee.id', 'id').where('employee.id IN (:...ids)', { ids: nextIds })
          .andWhere('employee.status = :status', { status: 'ACTIVE' }).getRawMany<{ id: string }>();
        if (valid.length !== nextIds.length) throw new ConflictException('Una o más excepciones no corresponden a empleados activos.');
      }
      const current = await runner.manager.find(EmployeeGovernmentVacationExclusion, {
        where: { governmentVacationDayId: day.id },
      });
      const currentIds = new Set(current.map((item) => item.employeeId));
      const nextSet = new Set(nextIds);
      const added = nextIds.filter((id) => !currentIds.has(id));
      const removed = [...currentIds].filter((id) => !nextSet.has(id));

      for (const employeeId of added) {
        await this.refundGovernmentDay(employeeId, day.id, runner.manager);
        await runner.manager.save(EmployeeGovernmentVacationExclusion,
          runner.manager.create(EmployeeGovernmentVacationExclusion, {
            employeeId, governmentVacationDayId: day.id,
            reason: 'Empleado exceptuado posteriormente del asueto a cuenta de vacaciones.', createdByUserId,
          }));
      }
      for (const employeeId of removed) {
        const applied = await this.applyGovernmentDay(employeeId, day, createdByUserId, runner.manager);
        if (!applied) throw new ConflictException('El empleado no tiene un período pendiente para aplicar el día Gobierno.');
        await runner.manager.delete(EmployeeGovernmentVacationExclusion, {
          governmentVacationDayId: day.id, employeeId,
        });
      }

      const movementCount = await runner.manager.count(VacationMovement, {
        where: { governmentVacationDayId: day.id, type: VacationMovementType.GOVERNMENT },
      });
      const activeCount = await runner.manager.count(Employee, { where: { status: 'ACTIVE' } });
      day.affectedEmployees = movementCount;
      day.excludedEmployees = nextIds.length;
      day.skippedEmployees = Math.max(0, activeCount - movementCount - nextIds.length);
      await runner.manager.save(GovernmentVacationDay, day);
      await runner.commitTransaction();
      return { ...day, excludedEmployeeIds: nextIds, kind: 'GOVERNMENT_VACATION' as const };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private async applyGovernmentDay(
    employeeId: string,
    day: GovernmentVacationDay,
    createdByUserId: string | null,
    manager: import('typeorm').EntityManager,
  ) {
    const existing = await manager.findOne(VacationMovement, {
      where: { employeeId, governmentVacationDayId: day.id, type: VacationMovementType.GOVERNMENT },
    });
    if (existing) return true;
    const period = await manager.createQueryBuilder(EmployeeVacationPeriod, 'period')
      .setLock('pessimistic_write')
      .where('period.employeeId = :employeeId', { employeeId })
      .andWhere('period.status = :status', { status: VacationPeriodStatus.PENDING })
      .orderBy('period.startDate', 'ASC').getOne();
    if (!period) return false;
    period.governmentDays = Number(period.governmentDays) + 1;
    await manager.save(EmployeeVacationPeriod, period);
    await this.movementService.createWithManager({
      employeeId, vacationPeriodId: period.id, vacationRequestId: null,
      governmentVacationDayId: day.id, type: VacationMovementType.GOVERNMENT,
      days: 1, movementDate: day.date,
      description: `${day.title} · asueto a cuenta de vacaciones`, createdByUserId,
    }, manager);
    return true;
  }

  private async refundGovernmentDay(employeeId: string, dayId: string, manager: import('typeorm').EntityManager) {
    const movements = await manager.find(VacationMovement, {
      where: { employeeId, governmentVacationDayId: dayId, type: VacationMovementType.GOVERNMENT },
    });
    for (const movement of movements) {
      if (movement.vacationPeriodId) {
        const period = await manager.findOne(EmployeeVacationPeriod, {
          where: { id: movement.vacationPeriodId }, lock: { mode: 'pessimistic_write' },
        });
        if (period) {
          const amount = Number(movement.days);
          period.governmentDays = Math.max(0, Number(period.governmentDays) - amount);
          if (period.status === VacationPeriodStatus.AVAILABLE) {
            period.availableDays = Number(period.availableDays) + amount;
          }
          await manager.save(EmployeeVacationPeriod, period);
        }
      }
      await manager.remove(VacationMovement, movement);
    }
  }
}
