// vacation-request-day.service.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VacationRequestDay } from './entities/vacation_request_days.entity';
import { VacationRequestDayStatus } from 'src/common/enums/vacation.enums';

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
        status: VacationRequestDayStatus.APPROVED,
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

  findSuspendibleWithManager(
    vacationRequestId: string,
    dates: string[],
    today: string,
    manager: EntityManager,
  ) {
    if (!dates.length) return Promise.resolve([]);
    return manager
      .createQueryBuilder(VacationRequestDay, 'day')
      .setLock('pessimistic_write')
      .where('day.vacation_request_id = :vacationRequestId', { vacationRequestId })
      .andWhere('day.date IN (:...dates)', { dates })
      .andWhere('day.date >= :today', { today })
      .andWhere('day.status = :status', { status: VacationRequestDayStatus.APPROVED })
      .andWhere('day.counts_as_vacation = true')
      .orderBy('day.date', 'ASC')
      .getMany();
  }

  findRemainingWithManager(
    vacationRequestId: string,
    fromDate: string,
    today: string,
    manager: EntityManager,
  ) {
    return manager
      .createQueryBuilder(VacationRequestDay, 'day')
      .setLock('pessimistic_write')
      .where('day.vacation_request_id = :vacationRequestId', { vacationRequestId })
      .andWhere('day.date >= :fromDate', { fromDate })
      .andWhere('day.date >= :today', { today })
      .andWhere('day.status = :status', { status: VacationRequestDayStatus.APPROVED })
      .andWhere('day.counts_as_vacation = true')
      .orderBy('day.date', 'ASC')
      .getMany();
  }

  async markSuspendedWithManager(
    days: VacationRequestDay[],
    suspensionId: string,
    manager: EntityManager,
  ) {
    days.forEach((day) => {
      day.status = VacationRequestDayStatus.SUSPENDED;
      day.counts_as_vacation = false;
      day.suspension_id = suspensionId;
    });
    return manager.save(VacationRequestDay, days);
  }

  countApprovedWithManager(vacationRequestId: string, manager: EntityManager) {
    return manager.count(VacationRequestDay, {
      where: {
        vacation_request_id: vacationRequestId,
        status: VacationRequestDayStatus.APPROVED,
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
