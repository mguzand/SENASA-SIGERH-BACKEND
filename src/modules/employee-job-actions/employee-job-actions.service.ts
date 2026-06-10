import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { CreateEmployeeJobActionDto } from './dto/create-employee-job-action.dto';
import { EmployeeJobActionType } from './enums/employee-job-action-type.enum';

import { EmployeeJobRecordService } from '../employee-job-record/employee-job-record.service';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';

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
    if (dto.action_type !== EmployeeJobActionType.MODALITY_CHANGE) {
      throw new BadRequestException('Tipo de acción no soportado todavía');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      /**
       * 1. Crear nuevo registro laboral
       * Aquí el service debe cerrar el registro anterior
       * y crear uno nuevo con la nueva modalidad.
       */
      const newJobRecord =
        await this.employeeJobRecordService.changeModalityWithManager(
          {
            employee_id: dto.employee_id,
            new_modality_id: dto.new_modality_id,
            modification_date: dto.modification_date,
            observation: dto.observation ?? null,
          },
          queryRunner.manager,
        );

      /**
       * 2. Recalcular períodos activos y pendientes
       */
      const recalculatedPeriods =
        await this.employeeVacationPeriodService.recalculatePeriodsByModalityChangeWithManager(
          {
            employee_id: dto.employee_id,
            new_employee_job_record_id: newJobRecord.id,
            new_modality_id: dto.new_modality_id,
            modification_date: dto.modification_date,
            observation: dto.observation ?? null,
            created_by_user_id: createdByUserId,
          },
          queryRunner.manager,
        );

      await queryRunner.commitTransaction();

      return {
        message: 'Cambio de modalidad aplicado correctamente',
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
}
