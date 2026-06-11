import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployeeJobActionDto } from './dto/create-employee-job-action.dto';
import { EmployeeJobActionType } from './enums/employee-job-action-type.enum';
import { EmployeeJobAction } from './entities/employee-job-action.entity';

import { EmployeeJobRecordService } from '../employee-job-record/employee-job-record.service';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { Employee } from '../employees/entities/employee.entity';

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
      .orderBy('action.modificationDate', 'DESC')
      .addOrderBy('action.created_at', 'DESC');

    if (employeeId) {
      query.andWhere('action.employeeId = :employeeId', { employeeId });
    }

    const actions = await query.getMany();

    return actions.map((action) =>
      this.mapAction(action, action.employee, null),
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
      default:
        return 'Acción al personal registrada correctamente';
    }
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
}
