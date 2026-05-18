import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { VacationMovement } from './entities/vacation-movement.entity';
import { CreateVacationMovementDto } from './dtos/create-vacation-moment.dto';
import { EntityManager, Repository } from 'typeorm';

@Injectable()
export class VacationMovementService {
  constructor(
    @InjectRepository(VacationMovement)
    private readonly vacationMovementRepository: Repository<VacationMovement>,
  ) {}

  async createWithManager(
    dto: CreateVacationMovementDto,
    manager: EntityManager,
  ): Promise<VacationMovement> {
    const movement = manager.create(VacationMovement, {
      employeeId: dto.employeeId,
      vacationPeriodId: dto.vacationPeriodId ?? null,
      vacationRequestId: dto.vacationRequestId ?? null,
      type: dto.type,
      days: dto.days,
      movementDate: dto.movementDate,
      description: dto.description ?? null,
      createdByUserId: dto.createdByUserId ?? null,
    });

    return await manager.save(VacationMovement, movement);
  }
}
