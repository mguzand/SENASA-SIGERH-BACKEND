import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { VacationRequestDetail } from './entities/vacation-request-detail.entity';

@Injectable()
export class VacationRequestDetailService {
  constructor(
    @InjectRepository(VacationRequestDetail)
    private readonly detailRepository: Repository<VacationRequestDetail>,
  ) {}

  async createWithManager(
    dto: {
      vacation_request_id: string;
      vacation_period_id: string;
      daysUsed: number;
    },
    manager: EntityManager,
  ) {
    const detail = manager.create(VacationRequestDetail, {
      vacationRequestId: dto.vacation_request_id,
      vacationPeriodId: dto.vacation_period_id,
      daysUsed: dto.daysUsed,
    });

    return manager.save(VacationRequestDetail, detail);
  }

  async findByRequest(vacation_request_id: string) {
    return this.detailRepository.find({
      where: { vacationRequestId: vacation_request_id },
      relations: ['vacationPeriod'],
    });
  }
}
