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
    const record = manager.create(EmployeeJobRecord, {
      employeeId,
      modalityId: dto.modality_id,
      nominal_position: dto.nominal_position || null,
      functional_position: dto.functional_position || null,
      area_id: dto.area_id || null,
      startDate: dto.start_date ? new Date(dto.start_date) : new Date(),
      endDate: null,
      salary: dto.salary || 0,
      status: dto.status ? String(dto.status).toUpperCase() : 'ACTIVE',
      notes: 'Registro inicial del empleado',
      previousRecordId: null,
    });

    return manager.save(EmployeeJobRecord, record);
  }
}
