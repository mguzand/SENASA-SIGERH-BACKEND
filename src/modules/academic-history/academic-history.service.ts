import { Injectable } from '@nestjs/common';
import { AcademicHistory } from './entities/academic-history.entity';
import { AcademicHistoryDto } from '../employees/dtos/create-employees.dto';
import { EntityManager } from 'typeorm';

@Injectable()
export class AcademicHistoryService {
  async createMany(
    employeeId: string,
    items: AcademicHistoryDto[],
    manager: EntityManager,
  ) {
    if (!items?.length) return [];

    const records = items.map((item) =>
      manager.create(AcademicHistory, {
        employeeId,
        nivel: item.level?.value,
        institution: item.institution,
        career: item.career,
        title: item.title,
        startYear: item.startYear,
        endYear: item.endYear,
        inProgress: item.inProgress,
        notes: item.notes,
      }),
    );

    return manager.save(AcademicHistory, records);
  }
}
