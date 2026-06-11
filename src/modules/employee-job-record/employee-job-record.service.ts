import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EmployeeJobRecord } from './entities/employee-job-record.entity';

@Injectable()
export class EmployeeJobRecordService {
  async createInitialRecord(
    employeeId: string,
    dto: any,
    manager: EntityManager,
  ) {
    const startDate = this.parseDateOnly(dto.start_date) ?? new Date();

    const record = manager.create(EmployeeJobRecord, {
      employeeId,
      modalityId: dto.modality_id,
      nominal_position: dto.nominal_position || null,
      functional_position: dto.functional_position || null,
      area_id: dto.area_id || null,
      startDate,
      endDate: null,
      salary: dto.salary || 0,
      status: dto.status ? String(dto.status).toUpperCase() : 'ACTIVE',
      isCurrent: true,
      notes: 'Registro inicial del empleado',
      previousRecordId: null,
    });

    return manager.save(EmployeeJobRecord, record);
  }

  async getCurrentRecordWithManager(
    employeeId: string,
    manager: EntityManager,
  ): Promise<EmployeeJobRecord> {
    const currentRecord = await manager.findOne(EmployeeJobRecord, {
      where: {
        employeeId,
        isCurrent: true,
      },
      order: {
        startDate: 'DESC',
      },
    });

    if (!currentRecord) {
      throw new BadRequestException(
        'El empleado no tiene un registro laboral activo',
      );
    }

    return currentRecord;
  }

  async changeModalityWithManager(
    dto: {
      employee_id: string;
      new_modality_id: string;
      modification_date: string;
      observation: string | null;
    },
    manager: EntityManager,
  ): Promise<EmployeeJobRecord> {
    const currentRecord = await this.getCurrentRecordWithManager(
      dto.employee_id,
      manager,
    );

    if (currentRecord.modalityId === dto.new_modality_id) {
      throw new BadRequestException(
        'El empleado ya tiene esta modalidad activa',
      );
    }

    await this.closeCurrentRecord(
      currentRecord,
      dto.modification_date,
      manager,
    );

    return this.createFollowUpRecord(
      {
        employeeId: dto.employee_id,
        modalityId: dto.new_modality_id,
        nominal_position: currentRecord.nominal_position,
        functional_position: currentRecord.functional_position,
        area_id: currentRecord.area_id,
        modification_date: dto.modification_date,
        observation: dto.observation,
        previousRecordId: currentRecord.id,
        salary: currentRecord.salary,
      },
      manager,
    );
  }

  async changeAreaWithManager(
    dto: {
      employee_id: string;
      new_area_id: string;
      modification_date: string;
      observation: string | null;
    },
    manager: EntityManager,
  ): Promise<EmployeeJobRecord> {
    const currentRecord = await this.getCurrentRecordWithManager(
      dto.employee_id,
      manager,
    );

    if (currentRecord.area_id === dto.new_area_id) {
      throw new BadRequestException('El empleado ya pertenece a esta área');
    }

    await this.closeCurrentRecord(
      currentRecord,
      dto.modification_date,
      manager,
    );

    return this.createFollowUpRecord(
      {
        employeeId: dto.employee_id,
        modalityId: currentRecord.modalityId,
        nominal_position: currentRecord.nominal_position,
        functional_position: currentRecord.functional_position,
        area_id: dto.new_area_id,
        modification_date: dto.modification_date,
        observation: dto.observation,
        previousRecordId: currentRecord.id,
        salary: currentRecord.salary,
      },
      manager,
    );
  }

  async changePositionWithManager(
    dto: {
      employee_id: string;
      new_nominal_position_id: string;
      new_functional_position_id: string;
      new_area_id?: string | null;
      modification_date: string;
      observation: string | null;
    },
    manager: EntityManager,
  ): Promise<EmployeeJobRecord> {
    const currentRecord = await this.getCurrentRecordWithManager(
      dto.employee_id,
      manager,
    );

    const nextAreaId = dto.new_area_id ?? currentRecord.area_id;
    const sameNominal =
      currentRecord.nominal_position === dto.new_nominal_position_id;
    const sameFunctional =
      currentRecord.functional_position === dto.new_functional_position_id;
    const sameArea = currentRecord.area_id === nextAreaId;

    if (sameNominal && sameFunctional && sameArea) {
      throw new BadRequestException(
        'El empleado ya tiene configurado ese puesto actual',
      );
    }

    await this.closeCurrentRecord(
      currentRecord,
      dto.modification_date,
      manager,
    );

    return this.createFollowUpRecord(
      {
        employeeId: dto.employee_id,
        modalityId: currentRecord.modalityId,
        nominal_position: dto.new_nominal_position_id,
        functional_position: dto.new_functional_position_id,
        area_id: nextAreaId,
        modification_date: dto.modification_date,
        observation: dto.observation,
        previousRecordId: currentRecord.id,
        salary: currentRecord.salary,
      },
      manager,
    );
  }

  private async closeCurrentRecord(
    currentRecord: EmployeeJobRecord,
    modificationDate: string,
    manager: EntityManager,
  ) {
    currentRecord.status = 'INACTIVE';
    currentRecord.isCurrent = false;
    currentRecord.endDate = this.getPreviousDay(modificationDate);

    await manager.save(EmployeeJobRecord, currentRecord);
  }

  private createFollowUpRecord(
    dto: {
      employeeId: string;
      modalityId: string;
      nominal_position: string | null;
      functional_position: string | null;
      area_id: string | null;
      modification_date: string;
      observation: string | null;
      previousRecordId: string | null;
      salary: number | null;
    },
    manager: EntityManager,
  ) {
    const newRecord = manager.create(EmployeeJobRecord, {
      employeeId: dto.employeeId,
      modalityId: dto.modalityId,
      nominal_position: dto.nominal_position,
      functional_position: dto.functional_position,
      area_id: dto.area_id,
      startDate: this.parseDateOnly(dto.modification_date) ?? new Date(),
      status: 'ACTIVE',
      isCurrent: true,
      notes: `Acción al personal. Observación: ${dto.observation ?? 'N/A'}`,
      previousRecordId: dto.previousRecordId,
      salary: dto.salary ?? 0,
      endDate: null,
    });

    return manager.save(EmployeeJobRecord, newRecord);
  }

  private getPreviousDay(dateString: string): string | null {
    const date = this.parseDateOnly(dateString);
    if (!date) return null;
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }

  private parseDateOnly(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return new Date(
        value.getFullYear(),
        value.getMonth(),
        value.getDate(),
        12,
        0,
        0,
        0,
      );
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
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
    }

    return null;
  }
}
