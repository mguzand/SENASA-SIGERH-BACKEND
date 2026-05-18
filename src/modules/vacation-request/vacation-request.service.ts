import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { VacationRequest } from './entities/vacation-request.entity';

import {
  VacationMovementType,
  VacationRequestStatus,
} from 'src/common/enums/vacation.enums';

import { VacationRequestStage } from './enum/vacation-request-stage.enum';

import { VacationRequestDetailService } from '../vacation-request-detail/vacation-request-detail.service';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';
import { VacationMovementService } from '../vacation-movement/vacation-movement.service';
import { VacationRequestDayService } from '../vacation_request_days/vacation_request_days.service';
import { CreateVacationRequestDto } from './dtos/create-vacation-request.dto';
import { ReviewVacationRequestDto } from './dtos/review-vacation-request.dto';

@Injectable()
export class VacationRequestService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(VacationRequest)
    private readonly vacationRequestRepository: Repository<VacationRequest>,

    private readonly vacationRequestDayService: VacationRequestDayService,
    private readonly vacationRequestDetailService: VacationRequestDetailService,
    private readonly employeeVacationPeriodService: EmployeeVacationPeriodService,
    private readonly vacationMovementService: VacationMovementService,
  ) {}

  async create(dto: CreateVacationRequestDto) {
    if (!dto.days || dto.days.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un día');
    }

    const sortedDays = [...new Set(dto.days)].sort();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = queryRunner.manager.create(VacationRequest, {
        employee_id: dto.employee_id,
        area_id: dto.area_id,
        start_date: sortedDays[0],
        end_date: sortedDays[sortedDays.length - 1],
        requested_days: sortedDays.length,
        approved_days: 0,
        employee_comment: dto.employee_comment ?? null,
        stage: VacationRequestStage.BOSS_REVIEW,
        status: VacationRequestStatus.PENDING,
        boss_status: VacationRequestStatus.PENDING,
        hr_status: VacationRequestStatus.PENDING,
        is_processed: false,
        processed_at: null,
      });

      const savedRequest = await queryRunner.manager.save(
        VacationRequest,
        request,
      );

      await this.vacationRequestDayService.createManyWithManager(
        savedRequest.id,
        sortedDays,
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      return this.findOne(savedRequest.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async bossReview(
    id: string,
    dto: ReviewVacationRequestDto,
    bossEmployeeId: string,
  ) {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Solicitud de vacaciones no encontrada');
    }

    if (request.stage !== VacationRequestStage.BOSS_REVIEW) {
      throw new BadRequestException(
        'La solicitud no está en revisión del jefe',
      );
    }

    if (request.status !== VacationRequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    if (
      dto.status !== VacationRequestStatus.APPROVED &&
      dto.status !== VacationRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Solo puede aprobar o rechazar');
    }

    request.boss_employee_id = bossEmployeeId;
    request.boss_status = dto.status;
    request.boss_observation = dto.observation ?? null;
    request.boss_reviewed_at = new Date();

    if (dto.status === VacationRequestStatus.APPROVED) {
      request.stage = VacationRequestStage.HR_REVIEW;
      request.status = VacationRequestStatus.PENDING;
    }

    if (dto.status === VacationRequestStatus.REJECTED) {
      request.stage = VacationRequestStage.COMPLETED;
      request.status = VacationRequestStatus.REJECTED;
    }

    return this.vacationRequestRepository.save(request);
  }

  async hrReview(
    id: string,
    dto: ReviewVacationRequestDto,
    hrEmployeeId: string,
  ) {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['days'],
    });

    if (!request) {
      throw new NotFoundException('Solicitud de vacaciones no encontrada');
    }

    if (request.stage !== VacationRequestStage.HR_REVIEW) {
      throw new BadRequestException('La solicitud no está en revisión de RRHH');
    }

    if (request.status !== VacationRequestStatus.PENDING) {
      throw new BadRequestException('La solicitud ya fue procesada');
    }

    if (request.is_processed) {
      throw new BadRequestException('Esta solicitud ya afectó saldos');
    }

    if (
      dto.status !== VacationRequestStatus.APPROVED &&
      dto.status !== VacationRequestStatus.REJECTED
    ) {
      throw new BadRequestException('Solo puede aprobar o rechazar');
    }

    if (dto.status === VacationRequestStatus.REJECTED) {
      request.hr_employee_id = hrEmployeeId;
      request.hr_status = VacationRequestStatus.REJECTED;
      request.hr_observation = dto.observation ?? null;
      request.hr_reviewed_at = new Date();
      request.stage = VacationRequestStage.COMPLETED;
      request.status = VacationRequestStatus.REJECTED;

      return this.vacationRequestRepository.save(request);
    }

    const validDays = await this.vacationRequestDayService.countValidDays(
      request.id,
    );

    if (validDays <= 0) {
      throw new BadRequestException('La solicitud no tiene días válidos');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const periodsConsumed =
        await this.employeeVacationPeriodService.consumeVacationDaysWithManager(
          {
            employee_id: request.employee_id,
            requested_days: validDays,
          },
          queryRunner.manager,
        );

      for (const item of periodsConsumed) {
        await this.vacationRequestDetailService.createWithManager(
          {
            vacation_request_id: request.id,
            vacation_period_id: item.vacation_period_id,
            daysUsed: item.days_used,
          },
          queryRunner.manager,
        );

        await this.vacationMovementService.createWithManager(
          {
            employeeId: request.employee_id,
            vacationPeriodId: item.vacation_period_id,
            vacationRequestId: request.id,
            type: VacationMovementType.REQUEST,
            days: item.days_used,
            movementDate: this.formatDate(new Date()),
            description: `Solicitud de vacaciones aprobada`,
            createdByUserId: hrEmployeeId,
          },
          queryRunner.manager,
        );
      }

      request.hr_employee_id = hrEmployeeId;
      request.hr_status = VacationRequestStatus.APPROVED;
      request.hr_observation = dto.observation ?? null;
      request.hr_reviewed_at = new Date();
      request.stage = VacationRequestStage.COMPLETED;
      request.status = VacationRequestStatus.APPROVED;
      request.approved_days = validDays;
      request.is_processed = true;
      request.processed_at = new Date();

      await queryRunner.manager.save(VacationRequest, request);

      await queryRunner.commitTransaction();

      return this.findOne(id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll() {
    return this.vacationRequestRepository.find({
      relations: [
        'employee',
        'area',
        'boss_employee',
        'hr_employee',
        'details',
        'adjustments',
        'days',
      ],
      order: { created_at: 'DESC' },
    });
  }

  async findByEmployee(employee_id: string) {
    return this.vacationRequestRepository.find({
      where: { employee_id },
      relations: ['days', 'details', 'adjustments'],
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string) {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: [
        'employee',
        'area',
        'boss_employee',
        'hr_employee',
        'days',
        'details',
        'details.vacationPeriod',
        'adjustments',
      ],
    });

    if (!request) {
      throw new NotFoundException('Solicitud de vacaciones no encontrada');
    }

    return request;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
