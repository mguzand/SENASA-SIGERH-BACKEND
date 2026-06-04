import { Injectable } from '@nestjs/common';
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
