// src/modules/employee-vacation-period/employee-vacation-period.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';

import { EmployeeVacationPeriod } from './entities/employee-vacation-period.entity';

import { VacationMovementService } from '../vacation-movement/vacation-movement.service';
import { VacationContractRuleService } from '../vacation-contract-rule/vacation-contract-rule.service';
import {
  VacationMovementType,
  VacationPeriodStatus,
} from 'src/common/enums/vacation.enums';
import { BootstrapVacationPeriodsDto } from './dto/bootstrap-vacation-periods.dto';

@Injectable()
export class EmployeeVacationPeriodService {
  private readonly logger = new Logger(EmployeeVacationPeriodService.name);

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(EmployeeVacationPeriod)
    private readonly periodRepository: Repository<EmployeeVacationPeriod>,

    private readonly vacationMovementService: VacationMovementService,
    private readonly vacationContractRuleService: VacationContractRuleService,
  ) {}

  async bootstrap(dto: BootstrapVacationPeriodsDto) {
    this.validateBootstrapInput(dto);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingPeriods = await queryRunner.manager.find(
        EmployeeVacationPeriod,
        {
          where: {
            employeeId: dto.employee_id,
          },
        },
      );

      if (existingPeriods.length > 0) {
        throw new BadRequestException(
          'Este empleado ya tiene períodos registrados',
        );
      }

      const createdPeriods = await this.createPeriodsWithManager(
        dto,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return {
        message: 'Períodos iniciales creados correctamente',
        employee_id: dto.employee_id,
        total_periods: createdPeriods.length,
        periods: createdPeriods,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bootstrapWithManager(
    dto: BootstrapVacationPeriodsDto,
    manager: EntityManager,
  ) {
    const existingPeriods = await manager.find(EmployeeVacationPeriod, {
      where: {
        employeeId: dto.employee_id,
      },
    });

    if (existingPeriods.length > 0) {
      throw new BadRequestException(
        'Este empleado ya tiene períodos registrados',
      );
    }

    this.validateBootstrapInput(dto);

    return this.createPeriodsWithManager(dto, manager);
  }

  async processVacationPeriods(): Promise<void> {
    const today = this.formatDate(new Date());

    const periods = await this.periodRepository.find({
      where: {
        accreditationDate: today,
        status: VacationPeriodStatus.PENDING,
      },
      relations: [
        'employee',
        'employeeJobRecord',
        'employeeJobRecord.employmentModality',
      ],
    });

    for (const period of periods) {
      await this.processSinglePeriod(period);
    }
  }

  private async processSinglePeriod(
    period: EmployeeVacationPeriod,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const availableDays =
        Number(period.earnedDays) -
        Number(period.usedDays) -
        Number(period.governmentDays) +
        Number(period.adjustmentDays);

      period.availableDays = availableDays;
      period.status = VacationPeriodStatus.AVAILABLE;

      await queryRunner.manager.save(period);

      await this.vacationMovementService.createWithManager(
        {
          employeeId: period.employeeId,
          vacationPeriodId: period.id,
          vacationRequestId: null,
          type: VacationMovementType.EARNED,
          days: Number(period.earnedDays),
          movementDate: this.formatDate(new Date()),
          description: `Acreditación automática del período ${period.startDate} - ${period.endDate}`,
          createdByUserId: null,
        },
        queryRunner.manager,
      );

      await this.createNextPeriod(period, queryRunner.manager);

      await this.closeOldPeriods(period.employeeId, queryRunner.manager);

      await queryRunner.commitTransaction();

      this.logger.log(`✅ Periodo procesado empleado ${period.employeeId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      this.logger.error(
        `❌ Error procesando periodo ${period.id}`,
        error?.stack || error,
      );
    } finally {
      await queryRunner.release();
    }
  }

  private validateBootstrapInput(dto: BootstrapVacationPeriodsDto) {
    if (!dto.periods || dto.periods.length === 0) {
      throw new BadRequestException('Debe enviar al menos un período');
    }

    const availableCount = dto.periods.filter(
      (p) => p.status === VacationPeriodStatus.AVAILABLE,
    ).length;

    const pendingCount = dto.periods.filter(
      (p) => p.status === VacationPeriodStatus.PENDING,
    ).length;

    if (availableCount > 2) {
      throw new BadRequestException(
        'Solo se permiten máximo 2 períodos disponibles',
      );
    }

    if (pendingCount > 1) {
      throw new BadRequestException(
        'Solo se permite máximo 1 período pendiente',
      );
    }

    const periodNumbers = dto.periods.map((p) => p.period_number);
    const duplicated = periodNumbers.some(
      (period, index) => periodNumbers.indexOf(period) !== index,
    );

    if (duplicated) {
      throw new BadRequestException('No puede repetir period_number');
    }
  }

  private async createPeriodsWithManager(
    dto: BootstrapVacationPeriodsDto,
    manager: EntityManager,
  ) {
    const createdPeriods: EmployeeVacationPeriod[] = [];

    const sortedPeriods = [...dto.periods].sort(
      (a, b) => a.period_number - b.period_number,
    );

    for (const item of sortedPeriods) {
      const period = manager.create(EmployeeVacationPeriod, {
        employeeId: dto.employee_id,
        employeeJobRecordId: dto.employee_job_record_id,
        periodNumber: item.period_number,
        startDate: item.start_date,
        endDate: item.end_date,
        accreditationDate: item.accreditation_date,
        earnedDays: item.earned_days,
        usedDays: item.used_days,
        governmentDays: item.government_days,
        adjustmentDays: item.adjustment_days,
        availableDays: item.available_days,
        status: item.status,
      });

      const savedPeriod = await manager.save(EmployeeVacationPeriod, period);

      createdPeriods.push(savedPeriod);

      await this.vacationMovementService.createWithManager(
        {
          employeeId: dto.employee_id,
          vacationPeriodId: savedPeriod.id,
          vacationRequestId: null,
          type: VacationMovementType.INITIAL_LOAD,
          days: Number(item.available_days),
          movementDate: this.formatDate(new Date()),
          description: `Carga inicial de vacaciones período ${item.start_date} - ${item.end_date}`,
          createdByUserId: null,
        },
        manager,
      );
    }

    return createdPeriods;
  }

  private async createNextPeriod(
    currentPeriod: EmployeeVacationPeriod,
    manager: EntityManager,
  ): Promise<void> {
    const nextPeriodNumber = currentPeriod.periodNumber + 1;

    const earnedDays =
      await this.vacationContractRuleService.getDaysByModalityAndYear(
        currentPeriod.employeeJobRecord.modalityId,
        nextPeriodNumber,
      );

    const currentEndDate = new Date(currentPeriod.endDate);

    const nextStartDate = new Date(currentEndDate);
    nextStartDate.setDate(nextStartDate.getDate() + 1);

    const nextEndDate = new Date(nextStartDate);
    nextEndDate.setFullYear(nextEndDate.getFullYear() + 1);
    nextEndDate.setDate(nextEndDate.getDate() - 1);

    const accreditationDate = new Date(nextEndDate);
    accreditationDate.setDate(accreditationDate.getDate() + 1);

    const newPeriod = this.periodRepository.create({
      employeeId: currentPeriod.employeeId,
      employeeJobRecordId: currentPeriod.employeeJobRecordId,
      periodNumber: nextPeriodNumber,
      startDate: this.formatDate(nextStartDate),
      endDate: this.formatDate(nextEndDate),
      accreditationDate: this.formatDate(accreditationDate),
      earnedDays,
      usedDays: 0,
      governmentDays: 0,
      adjustmentDays: 0,
      availableDays: 0,
      status: VacationPeriodStatus.PENDING,
    });

    await manager.save(newPeriod);
  }

  private async closeOldPeriods(
    employeeId: string,
    manager: EntityManager,
  ): Promise<void> {
    const periods = await this.periodRepository.find({
      where: { employeeId },
      order: { periodNumber: 'DESC' },
    });

    const oldPeriods = periods.slice(2);

    for (const period of oldPeriods) {
      if (period.status === VacationPeriodStatus.EXPIRED) continue;

      const expiredDays = Number(period.availableDays);

      period.status = VacationPeriodStatus.EXPIRED;
      period.availableDays = 0;

      await manager.save(period);

      await this.vacationMovementService.createWithManager(
        {
          employeeId: period.employeeId,
          vacationPeriodId: period.id,
          vacationRequestId: null,
          type: VacationMovementType.EXPIRED,
          days: expiredDays,
          movementDate: this.formatDate(new Date()),
          description: 'Periodo vencido automáticamente',
          createdByUserId: null,
        },
        manager,
      );
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  async consumeVacationDaysWithManager(
    dto: {
      employee_id: string;
      requested_days: number;
    },
    manager: EntityManager,
  ): Promise<
    {
      vacation_period_id: string;
      days_used: number;
    }[]
  > {
    let remainingDays = Number(dto.requested_days);

    const periods = await manager.find(EmployeeVacationPeriod, {
      where: {
        employeeId: dto.employee_id,
        status: VacationPeriodStatus.AVAILABLE,
        availableDays: MoreThan(0),
      },
      order: {
        startDate: 'ASC',
      },
    });

    const totalAvailable = periods.reduce(
      (total, period) => total + Number(period.availableDays),
      0,
    );

    if (totalAvailable < remainingDays) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponible: ${totalAvailable}, solicitado: ${remainingDays}`,
      );
    }

    const consumed: {
      vacation_period_id: string;
      days_used: number;
    }[] = [];

    for (const period of periods) {
      if (remainingDays <= 0) break;

      const available = Number(period.availableDays);
      const daysToUse = Math.min(available, remainingDays);

      period.usedDays = Number(period.usedDays) + daysToUse;
      period.availableDays = Number(period.availableDays) - daysToUse;

      await manager.save(EmployeeVacationPeriod, period);

      consumed.push({
        vacation_period_id: period.id,
        days_used: daysToUse,
      });

      remainingDays -= daysToUse;
    }

    return consumed;
  }

  async getAvailableDays(employeeId: string) {
    const periods = await this.periodRepository.find({
      where: {
        employeeId,
        status: VacationPeriodStatus.AVAILABLE,
      },
      order: {
        startDate: 'ASC',
      },
    });

    const totalDays = periods.reduce(
      (total, period) => total + Number(period.earnedDays),
      0,
    );

    const totalAvailableDays = periods.reduce(
      (total, period) => total + Number(period.availableDays),
      0,
    );

    return {
      employee_id: employeeId,
      total_available_days: totalAvailableDays,
      total_day: totalDays,
      periods: periods.map((period) => ({
        id: period.id,
        period_number: period.periodNumber,
        start_date: period.startDate,
        end_date: period.endDate,
        earned_days: Number(period.earnedDays),
        used_days: Number(period.usedDays),
        government_days: Number(period.governmentDays),
        adjustment_days: Number(period.adjustmentDays),
        available_days: Number(period.availableDays),
        status: period.status,
      })),
    };
  }
}
