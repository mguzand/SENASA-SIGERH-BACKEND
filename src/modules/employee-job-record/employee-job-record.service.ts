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
      notes: 'Registro inicial del empleado',
      previousRecordId: null,
    });

    return manager.save(EmployeeJobRecord, record);
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
    const currentRecord = await manager.findOne(EmployeeJobRecord, {
      where: {
        employeeId: dto.employee_id,
        status: 'ACTIVE',
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

    if (currentRecord.modalityId === dto.new_modality_id) {
      throw new BadRequestException(
        'El empleado ya tiene esta modalidad activa',
      );
    }

    currentRecord.status = 'INACTIVE';
    currentRecord.endDate = this.getPreviousDay(dto.modification_date);

    await manager.save(EmployeeJobRecord, currentRecord);

    const newRecord = manager.create(EmployeeJobRecord, {
      employeeId: dto.employee_id,
      modalityId: dto.new_modality_id,
      nominalPositionId: currentRecord.nominal_position,
      functionalPositionId: currentRecord.functional_position,
      area_id: currentRecord.area_id,
      startDate: dto.modification_date,
      status: 'ACTIVE',
      notes: `Cambio de modalidad. Observación: ${dto.observation ?? 'N/A'}`,
      previousRecordId: currentRecord.id,
      salary: currentRecord.salary,
      endDate: null,
    });

    return await manager.save(EmployeeJobRecord, newRecord);
  }

  private getPreviousDay(dateString: string): string | null {
    const date = new Date(dateString);
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
