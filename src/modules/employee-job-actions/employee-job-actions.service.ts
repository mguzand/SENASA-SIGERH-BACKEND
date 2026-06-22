import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployeeJobActionDto } from './dto/create-employee-job-action.dto';
import { EmployeeJobActionType } from './enums/employee-job-action-type.enum';
import { EmployeeJobAction } from './entities/employee-job-action.entity';

import { EmployeeJobRecordService } from '../employee-job-record/employee-job-record.service';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeUnpaidLeave } from '../employees/entities/employee-unpaid-leave.entity';
import { VacationPeriodStatus } from 'src/common/enums/vacation.enums';

@Injectable()
export class EmployeeJobActionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly employeeJobRecordService: EmployeeJobRecordService,
    private readonly employeeVacationPeriodService: EmployeeVacationPeriodService,
  ) {}

  async create(
    dto: CreateEmployeeJobActionDto,
    createdByUserId: string | null,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const employeeBefore = await queryRunner.manager.findOne(Employee, {
        where: { id: dto.employee_id },
      });

      if (!employeeBefore) {
        throw new BadRequestException('Empleado no encontrado');
      }

      const currentRecord = await this.findCurrentDetailedRecord(
        dto.employee_id,
        queryRunner.manager,
      );

      let newJobRecord: EmployeeJobRecord | null = null;
      let recalculatedPeriods: unknown[] = [];

      if (dto.action_type === EmployeeJobActionType.MODALITY_CHANGE) {
        newJobRecord =
          await this.employeeJobRecordService.changeModalityWithManager(
            {
              employee_id: dto.employee_id,
              new_modality_id: dto.new_modality_id!,
              modification_date: dto.modification_date,
              observation: dto.observation ?? null,
            },
            queryRunner.manager,
          );

        recalculatedPeriods =
          await this.employeeVacationPeriodService.recalculatePeriodsByModalityChangeWithManager(
            {
              employee_id: dto.employee_id,
              new_employee_job_record_id: newJobRecord.id,
              new_modality_id: dto.new_modality_id!,
              modification_date: dto.modification_date,
              observation: dto.observation ?? null,
              created_by_user_id: createdByUserId,
            },
            queryRunner.manager,
          );
      }

      if (dto.action_type === EmployeeJobActionType.AREA_CHANGE) {
        newJobRecord =
          await this.employeeJobRecordService.changeAreaWithManager(
            {
              employee_id: dto.employee_id,
              new_area_id: dto.new_area_id!,
              modification_date: dto.modification_date,
              observation: dto.observation ?? null,
            },
            queryRunner.manager,
          );
      }

      if (dto.action_type === EmployeeJobActionType.POSITION_CHANGE) {
        newJobRecord =
          await this.employeeJobRecordService.changePositionWithManager(
            {
              employee_id: dto.employee_id,
              new_nominal_position_id: dto.new_nominal_position_id!,
              new_functional_position_id: dto.new_functional_position_id!,
              new_area_id: dto.new_area_id ?? null,
              modification_date: dto.modification_date,
              observation: dto.observation ?? null,
            },
            queryRunner.manager,
          );
      }

      if (dto.action_type === EmployeeJobActionType.STATUS_CHANGE) {
        await this.updateEmployeeStatusWithManager(
          dto.employee_id,
          dto.new_employee_status!,
          queryRunner.manager,
        );
      }

      if (dto.action_type === EmployeeJobActionType.UNPAID_LEAVE) {
        recalculatedPeriods = await this.registerUnpaidLeaveWithManager(
          dto,
          queryRunner.manager,
        );
      }

      const employee = await queryRunner.manager.findOne(Employee, {
        where: { id: dto.employee_id },
      });

      if (!employee) {
        throw new BadRequestException('Empleado no encontrado');
      }

      const createdAction = await this.createHistoryRecord(
        dto,
        employeeBefore,
        currentRecord,
        newJobRecord,
        createdByUserId,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return {
        message: this.getSuccessMessage(dto.action_type),
        action: this.mapAction(createdAction, employee, currentRecord),
        employee_id: dto.employee_id,
        new_employee_job_record: newJobRecord,
        recalculated_periods: recalculatedPeriods,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(employeeId?: string) {
    const query = this.dataSource
      .getRepository(EmployeeJobAction)
      .createQueryBuilder('action')
      .leftJoinAndSelect('action.employee', 'employee')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'jobRecordArea')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )
      .orderBy('action.modificationDate', 'DESC')
      .addOrderBy('action.created_at', 'DESC');

    if (employeeId) {
      query.andWhere('action.employeeId = :employeeId', { employeeId });
    }

    const actions = await query.getMany();

    return actions.map((action) =>
      this.mapAction(action, action.employee, action.employee?.jobRecords?.[0] ?? null),
    );
  }

  private async createHistoryRecord(
    dto: CreateEmployeeJobActionDto,
    employee: Employee,
    currentRecord: EmployeeJobRecord | null,
    newJobRecord: EmployeeJobRecord | null,
    createdByUserId: string | null,
    manager: EntityManager,
  ) {
    const actionNumber = await this.generateActionNumber(manager);
    const snapshot = await this.resolveActionSnapshot(
      dto,
      currentRecord,
      manager,
    );

    const action = manager.create(EmployeeJobAction, {
      actionNumber,
      employeeId: dto.employee_id,
      actionType: dto.action_type,
      modificationDate: this.parseDateOnly(dto.modification_date),
      previousValue: snapshot.previousValue,
      nextValue: snapshot.nextValue,
      summary: snapshot.summary,
      observation: dto.observation?.trim() || null,
      createdByUserId,
      status: 'REGISTERED',
      newModalityId: dto.new_modality_id ?? null,
      newAreaId: dto.new_area_id ?? null,
      newOrganizationalTypeId: dto.new_organizational_type_id ?? null,
      newNominalPositionId: dto.new_nominal_position_id ?? null,
      newFunctionalPositionId: dto.new_functional_position_id ?? null,
      newEmployeeStatus: dto.new_employee_status
        ? String(dto.new_employee_status).toUpperCase()
        : null,
      previousJobRecordId: currentRecord?.id ?? null,
      newJobRecordId: newJobRecord?.id ?? null,
    });

    const saved = await manager.save(EmployeeJobAction, action);
    return saved;
  }

  private async resolveActionSnapshot(
    dto: CreateEmployeeJobActionDto,
    currentRecord: EmployeeJobRecord | null,
    manager: EntityManager,
  ) {
    if (dto.action_type === EmployeeJobActionType.MODALITY_CHANGE) {
      const modality = await manager
        .createQueryBuilder()
        .select('modality.name', 'name')
        .from('employment_modalities', 'modality')
        .where('modality.id = :id', { id: dto.new_modality_id })
        .getRawOne<{ name: string | null }>();

      const previousValue = currentRecord?.modality?.name ?? null;
      const nextValue = modality?.name ?? null;

      return {
        previousValue,
        nextValue,
        summary: `Cambio de contratación desde ${previousValue || 'Sin modalidad'} hacia ${nextValue || 'modalidad seleccionada'}.`,
      };
    }

    if (dto.action_type === EmployeeJobActionType.AREA_CHANGE) {
      const area = await manager
        .createQueryBuilder()
        .select('area.name', 'name')
        .from('organizational_units', 'area')
        .where('area.id = :id', { id: dto.new_area_id })
        .getRawOne<{ name: string | null }>();

      const previousValue = currentRecord?.area?.name ?? null;
      const nextValue = area?.name ?? null;

      return {
        previousValue,
        nextValue,
        summary: `Cambio de área desde ${previousValue || 'Sin área'} hacia ${nextValue || 'área seleccionada'}.`,
      };
    }

    if (dto.action_type === EmployeeJobActionType.POSITION_CHANGE) {
      const [nominalPosition, functionalPosition, area] = await Promise.all([
        manager
          .createQueryBuilder()
          .select('position.name', 'name')
          .from('positions', 'position')
          .where('position.id = :id', { id: dto.new_nominal_position_id })
          .getRawOne<{ name: string | null }>(),
        manager
          .createQueryBuilder()
          .select('position.name', 'name')
          .from('positions', 'position')
          .where('position.id = :id', { id: dto.new_functional_position_id })
          .getRawOne<{ name: string | null }>(),
        dto.new_area_id
          ? manager
              .createQueryBuilder()
              .select('area.name', 'name')
              .from('organizational_units', 'area')
              .where('area.id = :id', { id: dto.new_area_id })
              .getRawOne<{ name: string | null }>()
          : Promise.resolve<{ name: string | null } | null>(null),
      ]);

      const previousPosition =
        currentRecord?.functionalPosition?.name ||
        currentRecord?.position?.name ||
        null;
      const nextPosition =
        functionalPosition?.name || nominalPosition?.name || null;
      const nextArea = area?.name ?? currentRecord?.area?.name ?? null;

      return {
        previousValue: previousPosition,
        nextValue: nextArea
          ? `${nextPosition || 'Puesto seleccionado'} · ${nextArea}`
          : nextPosition,
        summary: `Cambio de puesto hacia ${nextPosition || 'puesto seleccionado'}${nextArea ? ` en ${nextArea}` : ''}.`,
      };
    }

    if (dto.action_type === EmployeeJobActionType.UNPAID_LEAVE) {
      const startDate = this.parseDateOnlyStrict(dto.new_unpaid_leave_start_date);
      const endDate = this.parseDateOnlyStrict(dto.new_unpaid_leave_end_date);

      if (!startDate || !endDate) {
        return {
          previousValue: 'Sin licencia',
          nextValue: null,
          summary: 'Licencia sin goce de sueldo registrada.',
        };
      }

      const days = this.getInclusiveDays(startDate, endDate);
      const dateRange = `${this.formatHumanDate(startDate)} al ${this.formatHumanDate(endDate)}`;

      return {
        previousValue: 'Sin licencia',
        nextValue: `${dateRange} · ${days} día${days === 1 ? '' : 's'}`,
        summary: `Licencia sin goce de sueldo del ${dateRange} (${days} día${days === 1 ? '' : 's'}).`,
      };
    }

    const nextStatus = this.readableStatus(dto.new_employee_status);
    return {
      previousValue: this.readableStatus(currentRecord?.employee?.status),
      nextValue: nextStatus,
      summary: `Cambio de estado hacia ${nextStatus || 'estado seleccionado'}.`,
    };
  }

  private async findCurrentDetailedRecord(
    employeeId: string,
    manager: EntityManager,
  ) {
    return manager.findOne(EmployeeJobRecord, {
      where: {
        employeeId,
        status: 'ACTIVE',
      },
      relations: {
        employee: true,
        modality: true,
        area: true,
        position: true,
        functionalPosition: true,
      },
      order: {
        startDate: 'DESC',
      },
    });
  }

  private async getCurrentDetailedRecord(
    employeeId: string,
    manager: EntityManager,
  ) {
    const record = await this.findCurrentDetailedRecord(employeeId, manager);

    if (!record) {
      throw new BadRequestException(
        'El empleado no tiene un registro laboral activo',
      );
    }

    return record;
  }

  private async updateEmployeeStatusWithManager(
    employeeId: string,
    newStatus: string,
    manager: EntityManager,
  ) {
    const employee = await manager.findOne(Employee, {
      where: { id: employeeId },
    });

    if (!employee) {
      throw new BadRequestException('Empleado no encontrado');
    }

    const normalizedNextStatus = String(newStatus || '')
      .trim()
      .toUpperCase();
    const normalizedCurrentStatus = String(employee.status || '')
      .trim()
      .toUpperCase();

    if (!normalizedNextStatus) {
      throw new BadRequestException('Debes seleccionar el nuevo estado');
    }

    if (normalizedCurrentStatus === normalizedNextStatus) {
      throw new BadRequestException('El empleado ya tiene ese estado asignado');
    }

    employee.status = normalizedNextStatus;
    await manager.save(Employee, employee);
  }

  private async generateActionNumber(manager: EntityManager) {
    const year = new Date().getFullYear();
    const prefix = `APT-${year}-`;
    const count = await manager
      .createQueryBuilder(EmployeeJobAction, 'action')
      .where('action.actionNumber LIKE :prefix', { prefix: `${prefix}%` })
      .getCount();

    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  private mapAction(
    action: EmployeeJobAction,
    employee: Employee | null,
    currentRecord: EmployeeJobRecord | null,
  ) {
    const fullName = [
      employee?.firstName,
      employee?.middleName,
      employee?.lastName,
      employee?.secondLastName,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: action.id,
      number: action.actionNumber,
      employeeId: action.employeeId,
      employeeName: fullName || 'Empleado',
      employeeCode: employee?.biometric_id
        ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
        : employee?.id
          ? `EMP-${employee.id.slice(0, 4).toUpperCase()}`
          : null,
      employeeStatus: employee?.status
        ? String(employee.status).toUpperCase()
        : null,
      departmentName: currentRecord?.area?.name ?? null,
      positionName:
        currentRecord?.functionalPosition?.name ||
        currentRecord?.position?.name ||
        null,
      actionType: this.mapFrontendActionType(action.actionType),
      actionLabel: this.getActionLabel(action.actionType),
      effectiveDate: this.serializeDateOnly(action.modificationDate),
      createdAt:
        action.created_at?.toISOString?.() ??
        new Date(action.created_at as Date).toISOString(),
      observation: action.observation,
      summary: action.summary || this.getActionLabel(action.actionType),
      previousValue: action.previousValue,
      nextValue: action.nextValue,
      status: 'Registrada',
    };
  }

  private getActionLabel(type: EmployeeJobActionType) {
    switch (type) {
      case EmployeeJobActionType.AREA_CHANGE:
        return 'Cambio de área';
      case EmployeeJobActionType.MODALITY_CHANGE:
        return 'Cambio de contratación';
      case EmployeeJobActionType.POSITION_CHANGE:
        return 'Cambio de puesto';
      case EmployeeJobActionType.STATUS_CHANGE:
        return 'Cambio de estado';
      case EmployeeJobActionType.UNPAID_LEAVE:
        return 'Licencia sin goce de sueldo';
      default:
        return 'Acción al personal';
    }
  }

  private mapFrontendActionType(type: EmployeeJobActionType) {
    switch (type) {
      case EmployeeJobActionType.AREA_CHANGE:
        return 'area_change';
      case EmployeeJobActionType.MODALITY_CHANGE:
        return 'contract_change';
      case EmployeeJobActionType.POSITION_CHANGE:
        return 'position_change';
      case EmployeeJobActionType.STATUS_CHANGE:
        return 'status_change';
      case EmployeeJobActionType.UNPAID_LEAVE:
        return 'unpaid_leave';
      default:
        return 'status_change';
    }
  }

  private getSuccessMessage(type: EmployeeJobActionType) {
    switch (type) {
      case EmployeeJobActionType.AREA_CHANGE:
        return 'Cambio de área aplicado correctamente';
      case EmployeeJobActionType.MODALITY_CHANGE:
        return 'Cambio de contratación aplicado correctamente';
      case EmployeeJobActionType.POSITION_CHANGE:
        return 'Cambio de puesto aplicado correctamente';
      case EmployeeJobActionType.STATUS_CHANGE:
        return 'Cambio de estado aplicado correctamente';
      case EmployeeJobActionType.UNPAID_LEAVE:
        return 'Licencia sin goce registrada correctamente';
      default:
        return 'Acción al personal registrada correctamente';
    }
  }

  private async registerUnpaidLeaveWithManager(
    dto: CreateEmployeeJobActionDto,
    manager: EntityManager,
  ) {
    const startDate = this.parseDateOnlyStrict(dto.new_unpaid_leave_start_date);
    const endDate = this.parseDateOnlyStrict(dto.new_unpaid_leave_end_date);

    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Las fechas de la licencia sin goce no son válidas',
      );
    }

    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'La fecha final de la licencia sin goce no puede ser anterior al inicio.',
      );
    }

    const days = this.getInclusiveDays(startDate, endDate);

    await manager.insert(EmployeeUnpaidLeave, {
      employeeId: dto.employee_id,
      startDate,
      endDate,
      days,
      observation: dto.observation?.trim() || null,
    });

    const employee = await manager.findOne(Employee, {
      where: { id: dto.employee_id },
    });

    if (!employee?.entryDate) {
      throw new BadRequestException(
        'El empleado no tiene fecha de ingreso registrada',
      );
    }

    const entryDate = this.parseDateOnlyStrict(
      this.serializeDateOnly(employee.entryDate),
    );

    if (!entryDate) {
      throw new BadRequestException(
        'La fecha de ingreso del empleado no es válida',
      );
    }

    const periods = await manager.find(EmployeeVacationPeriod, {
      where: [
        {
          employeeId: dto.employee_id,
          status: VacationPeriodStatus.AVAILABLE,
        },
        {
          employeeId: dto.employee_id,
          status: VacationPeriodStatus.PENDING,
        },
      ],
      order: {
        periodNumber: 'ASC',
      },
    });

    if (!periods.length) {
      return [];
    }

    const firstAffectedPeriod = this.findFirstAffectedPeriodNumber(
      entryDate,
      startDate,
      endDate,
      periods[periods.length - 1].periodNumber,
    );

    if (firstAffectedPeriod === null) {
      return [];
    }

    const adjustedPeriods: Array<{
      period_id: string;
      period_number: number;
      old_end_date: string;
      new_end_date: string;
      old_accreditation_date: string;
      new_accreditation_date: string;
      shift_days: number;
    }> = [];

    for (const period of periods) {
      if (period.periodNumber < firstAffectedPeriod) {
        continue;
      }

      const oldEndDate = this.parseDateOnlyStrict(this.serializeDateOnly(period.endDate));
      const oldAccreditationDate = this.parseDateOnlyStrict(
        this.serializeDateOnly(period.accreditationDate),
      );

      if (!oldEndDate || !oldAccreditationDate) {
        continue;
      }

      period.endDate = this.serializeDateOnly(this.addDays(oldEndDate, days));
      period.accreditationDate = this.serializeDateOnly(
        this.addDays(oldAccreditationDate, days),
      );

      await manager.save(EmployeeVacationPeriod, period);

      adjustedPeriods.push({
        period_id: period.id,
        period_number: period.periodNumber,
        old_end_date: this.serializeDateOnly(oldEndDate),
        new_end_date: period.endDate,
        old_accreditation_date: this.serializeDateOnly(oldAccreditationDate),
        new_accreditation_date: period.accreditationDate,
        shift_days: days,
      });
    }

    return adjustedPeriods;
  }

  private readableStatus(status: string | null | undefined) {
    const normalized = String(status || '')
      .trim()
      .toUpperCase();

    switch (normalized) {
      case 'ACTIVE':
        return 'Activo';
      case 'INACTIVE':
        return 'Inactivo';
      case 'SUSPENDED':
        return 'Suspendido';
      case 'VACATION':
        return 'En vacaciones';
      case 'DISABILITY':
        return 'En incapacidad';
      default:
        return normalized || null;
    }
  }

  private parseDateOnly(value: string) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return new Date();

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0,
    );
  }

  private serializeDateOnly(value: Date | string | null | undefined) {
    if (!value) return '';

    const date =
      value instanceof Date
        ? value
        : this.parseDateOnly(String(value).split('T')[0] || '');

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseDateOnlyStrict(value: string | null | undefined) {
    if (!value) return null;

    const match = String(value)
      .trim()
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return null;

    const date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      12,
      0,
      0,
      0,
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatHumanDate(value: Date) {
    return value.toLocaleDateString('es-HN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private addYears(date: Date, years: number) {
    const nextDate = new Date(date);
    nextDate.setFullYear(nextDate.getFullYear() + years);
    return nextDate;
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
  }

  private getInclusiveDays(start: Date, end: Date) {
    const millisecondsPerDay = 1000 * 60 * 60 * 24;
    return Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1;
  }

  private findFirstAffectedPeriodNumber(
    entryDate: Date,
    leaveStart: Date,
    leaveEnd: Date,
    maxPeriodNumber: number,
  ) {
    for (let currentPeriod = 1; currentPeriod <= maxPeriodNumber; currentPeriod++) {
      const periodStart = this.addYears(entryDate, currentPeriod - 1);
      const accreditationDate = this.addYears(entryDate, currentPeriod);

      const overlapsCurrentPeriod =
        leaveStart.getTime() <= accreditationDate.getTime() &&
        leaveEnd.getTime() >= periodStart.getTime();

      if (overlapsCurrentPeriod) {
        return currentPeriod;
      }
    }

    return null;
  }
}
