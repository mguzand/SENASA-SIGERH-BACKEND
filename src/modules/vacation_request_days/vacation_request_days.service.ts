// vacation-request-day.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VacationRequestDay } from './entities/vacation_request_days.entity';

@Injectable()
export class VacationRequestDayService {
  constructor(
    @InjectRepository(VacationRequestDay)
    private readonly dayRepository: Repository<VacationRequestDay>,
  ) {}

  async createManyWithManager(
    vacation_request_id: string,
    days: string[],
    manager: EntityManager,
  ) {
    const records = days.map((date) =>
      manager.create(VacationRequestDay, {
        vacation_request_id,
        date,
        counts_as_vacation: true,
        note: null,
      }),
    );

    return manager.save(VacationRequestDay, records);
  }

  async countValidDays(vacation_request_id: string): Promise<number> {
    return this.dayRepository.count({
      where: {
        vacation_request_id,
        counts_as_vacation: true,
      },
    });
  }

  async findByRequest(vacation_request_id: string) {
    return this.dayRepository.find({
      where: { vacation_request_id },
      order: { date: 'ASC' },
    });
  }
}
