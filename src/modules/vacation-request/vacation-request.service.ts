import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';

import { VacationRequest } from './entities/vacation-request.entity';

import {
  VacationMovementType,
  VacationRequestStatus,
} from 'src/common/enums/vacation.enums';

import { VacationRequestStage } from './enum/vacation-request-stage.enum';

import {
  sendRequestNotification,
  sendVacations,
} from 'src/common/helpers/send-email.helper';
import { AreaManagerService } from '../area-manager/area-manager.service';
import { AreaManagerRole } from '../area-manager/interfaces/area-manager-role.enum';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';
import { VacationMovementService } from '../vacation-movement/vacation-movement.service';
import { VacationRequestDetailService } from '../vacation-request-detail/vacation-request-detail.service';
import { VacationRequestDayService } from '../vacation_request_days/vacation_request_days.service';
import { CreateManualVacationRequestDto } from './dtos/create-manual-vacation-request.dto';
import { CreateVacationRequestDto } from './dtos/create-vacation-request.dto';
import { ListHrVacationRequestsDto } from './dtos/list-hr-vacation-requests.dto';
import { ReviewVacationRequestDto } from './dtos/review-vacation-request.dto';
import { ApprovalRoutingService } from '../area-manager/approval-routing.service';
import { Employee } from '../employees/entities/employee.entity';
import { RegionalManagerService } from '../area-manager/regional-manager.service';

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
    private readonly areaManagerService: AreaManagerService,
    private readonly approvalRoutingService: ApprovalRoutingService,
    private readonly regionalManagerService: RegionalManagerService,
  ) {}

  async createManual(
    dto: CreateManualVacationRequestDto,
    hrEmployeeId: string,
  ) {
    if (!dto.days || dto.days.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un día');
    }

    const sortedDays = [...new Set(dto.days)].sort();
    const validDays = sortedDays.length;

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = queryRunner.manager.create(VacationRequest, {
        employee_id: dto.employee_id,
        area_id: dto.area_id,

        start_date: sortedDays[0],
        end_date: sortedDays[sortedDays.length - 1],

        requested_days: validDays,
        approved_days: validDays,

        employee_comment: dto.employee_comment ?? null,

        stage: VacationRequestStage.COMPLETED,
        status: VacationRequestStatus.APPROVED,

        boss_employee_id: null,
        boss_status: VacationRequestStatus.APPROVED,
        boss_observation: 'Solicitud ingresada manualmente por RRHH',
        boss_reviewed_at: new Date(),

        hr_employee_id: hrEmployeeId,
        hr_status: VacationRequestStatus.APPROVED,
        hr_observation:
          dto.hr_observation ?? 'Solicitud manual aprobada por RRHH',
        hr_reviewed_at: new Date(),

        is_processed: true,
        processed_at: new Date(),

        is_manual: true,
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

      const periodsConsumed =
        await this.employeeVacationPeriodService.consumeVacationDaysWithManager(
          {
            employee_id: dto.employee_id,
            requested_days: validDays,
          },
          queryRunner.manager,
        );

      for (const item of periodsConsumed) {
        await this.vacationRequestDetailService.createWithManager(
          {
            vacation_request_id: savedRequest.id,
            vacation_period_id: item.vacation_period_id,
            daysUsed: item.days_used,
          },
          queryRunner.manager,
        );

        await this.vacationMovementService.createWithManager(
          {
            employeeId: dto.employee_id,
            vacationPeriodId: item.vacation_period_id,
            vacationRequestId: savedRequest.id,
            type: VacationMovementType.REQUEST,
            days: item.days_used,
            movementDate: this.formatDate(new Date()),
            description: 'Solicitud manual de vacaciones registrada por RRHH',
            createdByUserId: hrEmployeeId,
          },
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();

      return this.findOne(savedRequest.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findHrInbox(
    params: ListHrVacationRequestsDto,
    currentEmployeeId: string,
  ) {
    // const areaIds = await this.areaManagerService.findAreaIdsByEmployeeAndRole(
    //   currentEmployeeId,
    //   AreaManagerRole.HR,
    // );

    //if (!areaIds.length) {
    // return {
    //   data: [],
    //   meta: {
    //     page: 1,
    //     limit: Math.min(Math.max(Number(params.limit) || 6, 1), 24),
    //     total: 0,
    //     totalPages: 0,
    //   },
    //   stats: {
    //     pending: 0,
    //     requestedDays: 0,
    //     approved: 0,
    //     rejected: 0,
    //     total: 0,
    //   },
    // };
    //}

    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 6, 1), 24);
    const status = params.status || 'pending';

    const query = this.vacationRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect('request.area', 'area')
      //.where('request.area_id IN (:...areaIds)', { areaIds })
      .andWhere('request.boss_status = :bossApproved', {
        bossApproved: VacationRequestStatus.APPROVED,
      })
      .andWhere('(request.liaison_review_required = false OR request.liaison_status = :liaisonApproved OR request.status <> :liaisonPending)', {
        liaisonApproved: VacationRequestStatus.APPROVED,
        liaisonPending: VacationRequestStatus.PENDING,
      });

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            "LOWER(COALESCE(request.employee_comment, '')) LIKE :search",
            {
              search,
            },
          );
          qb.orWhere('LOWER(employee.firstName) LIKE :search', { search });
          qb.orWhere("LOWER(COALESCE(employee.middleName, '')) LIKE :search", {
            search,
          });
          qb.orWhere('LOWER(employee.lastName) LIKE :search', { search });
          qb.orWhere(
            "LOWER(COALESCE(employee.secondLastName, '')) LIKE :search",
            { search },
          );
          qb.orWhere("LOWER(COALESCE(employee.dni, '')) LIKE :search", {
            search,
          });
          qb.orWhere(
            "LOWER(COALESCE(employee.biometric_id, '')) LIKE :search",
            { search },
          );
          qb.orWhere("LOWER(COALESCE(area.name, '')) LIKE :search", { search });
          qb.orWhere(
            `LOWER(
              CONCAT(
                employee.firstName, ' ',
                COALESCE(employee.middleName, ''), ' ',
                employee.lastName, ' ',
                COALESCE(employee.secondLastName, '')
              )
            ) LIKE :search`,
            { search },
          );
        }),
      );
    }

    this.applyHrInboxStatusFilter(query, status, currentEmployeeId);

    query
      .addSelect(
        `CASE
          WHEN request.hr_status = '${VacationRequestStatus.PENDING}' THEN 0
          WHEN request.hr_status = '${VacationRequestStatus.APPROVED}' THEN 1
          ELSE 2
        END`,
        'hr_status_order',
      )
      .orderBy('hr_status_order', 'ASC')
      .addOrderBy('request.start_date', 'DESC')
      .addOrderBy('request.created_at', 'DESC');

    const [requests, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsBaseQuery = this.vacationRequestRepository
      .createQueryBuilder('request')
      //.where('request.area_id IN (:...areaIds)', { areaIds })
      .andWhere('request.boss_status = :bossApproved', {
        bossApproved: VacationRequestStatus.APPROVED,
      })
      .andWhere('(request.liaison_review_required = false OR request.liaison_status = :liaisonApproved OR request.status <> :liaisonPending)', {
        liaisonApproved: VacationRequestStatus.APPROVED,
        liaisonPending: VacationRequestStatus.PENDING,
      });

    const pendingCount = await this.applyHrInboxStatusFilter(
      statsBaseQuery.clone(),
      'pending',
      currentEmployeeId,
    ).getCount();

    const approvedCount = await this.applyHrInboxStatusFilter(
      statsBaseQuery.clone(),
      'approved',
      currentEmployeeId,
    ).getCount();

    const rejectedCount = await this.applyHrInboxStatusFilter(
      statsBaseQuery.clone(),
      'rejected',
      currentEmployeeId,
    ).getCount();

    const pendingDaysQuery = this.applyHrInboxStatusFilter(
      statsBaseQuery
        .clone()
        .select('COALESCE(SUM(request.requested_days), 0)', 'totalDays'),
      'pending',
      currentEmployeeId,
    );
    const pendingDaysRaw = (await pendingDaysQuery.getRawOne()) as {
      totalDays: string;
    } | null;

    return {
      data: requests.map((request) => {
        const employee = request.employee;
        const fullName = [
          employee?.firstName,
          employee?.middleName,
          employee?.lastName,
          employee?.secondLastName,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          id: request.id,
          employeeId: employee?.id || null,
          employeeCode: employee?.biometric_id
            ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
            : employee?.id
              ? `EMP-${employee.id.slice(0, 4).toUpperCase()}`
              : 'EMP-0000',
          employeeName: fullName || 'Empleado sin nombre',
          employeeInitials:
            `${employee?.firstName?.[0] || ''}${employee?.lastName?.[0] || ''}`
              .toUpperCase()
              .trim(),
          departmentName: request.area?.name || 'Sin área asignada',
          status: request.hr_status,
          stage: request.stage,
          startDate: request.start_date,
          endDate: request.end_date,
          requestedDays: Number(request.requested_days || 0),
          approvedDays: Number(request.approved_days || 0),
          employeeComment: request.employee_comment,
          resolvedAt: request.hr_reviewed_at || request.updated_at || null,
          timingLabel: this.getTimingLabel(request.start_date),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: pendingCount,
        requestedDays: Number(pendingDaysRaw?.totalDays || 0),
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
    };
  }

  async findBossInbox(
    params: ListHrVacationRequestsDto,
    currentEmployeeId: string,
  ) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 6, 1), 24);
    const status = params.status || 'pending';

    const query = this.vacationRequestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect('request.area', 'area');

    this.applyBossOwnershipFilter(query, currentEmployeeId);

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            "LOWER(COALESCE(request.employee_comment, '')) LIKE :search",
            { search },
          );
          qb.orWhere('LOWER(employee.firstName) LIKE :search', { search });
          qb.orWhere("LOWER(COALESCE(employee.middleName, '')) LIKE :search", {
            search,
          });
          qb.orWhere('LOWER(employee.lastName) LIKE :search', { search });
          qb.orWhere(
            "LOWER(COALESCE(employee.secondLastName, '')) LIKE :search",
            { search },
          );
          qb.orWhere("LOWER(COALESCE(area.name, '')) LIKE :search", { search });
          qb.orWhere(
            `LOWER(
              CONCAT(
                employee.firstName, ' ',
                COALESCE(employee.middleName, ''), ' ',
                employee.lastName, ' ',
                COALESCE(employee.secondLastName, '')
              )
            ) LIKE :search`,
            { search },
          );
        }),
      );
    }

    this.applyBossInboxStatusFilter(query, status);

    query
      .addSelect(
        `CASE
          WHEN request.boss_status = '${VacationRequestStatus.PENDING}' THEN 0
          WHEN request.boss_status = '${VacationRequestStatus.APPROVED}' THEN 1
          ELSE 2
        END`,
        'boss_status_order',
      )
      .orderBy('boss_status_order', 'ASC')
      .addOrderBy('request.start_date', 'DESC')
      .addOrderBy('request.created_at', 'DESC');
    const [requests, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsBaseQuery = this.vacationRequestRepository
      .createQueryBuilder('request');

    this.applyBossOwnershipFilter(
      statsBaseQuery,
      currentEmployeeId,
    );

    const pendingCount = await this.applyBossInboxStatusFilter(
      statsBaseQuery.clone(),
      'pending',
    ).getCount();

    const approvedCount = await this.applyBossInboxStatusFilter(
      statsBaseQuery.clone(),
      'approved',
    ).getCount();

    const rejectedCount = await this.applyBossInboxStatusFilter(
      statsBaseQuery.clone(),
      'rejected',
    ).getCount();

    const pendingDaysRaw = (await this.applyBossInboxStatusFilter(
      statsBaseQuery
        .clone()
        .select('COALESCE(SUM(request.requested_days), 0)', 'totalDays'),
      'pending',
    ).getRawOne()) as { totalDays: string } | null;

    return {
      data: requests.map((request) => {
        const employee = request.employee;
        const fullName = [
          employee?.firstName,
          employee?.middleName,
          employee?.lastName,
          employee?.secondLastName,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          id: request.id,
          employeeId: employee?.id || null,
          employeeCode: employee?.biometric_id
            ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
            : employee?.id
              ? `EMP-${employee.id.slice(0, 4).toUpperCase()}`
              : 'EMP-0000',
          employeeName: fullName || 'Empleado sin nombre',
          employeeInitials:
            `${employee?.firstName?.[0] || ''}${employee?.lastName?.[0] || ''}`
              .toUpperCase()
              .trim(),
          departmentName: request.area?.name || 'Sin área asignada',
          status: request.boss_status,
          stage: request.stage,
          startDate: request.start_date,
          endDate: request.end_date,
          requestedDays: Number(request.requested_days || 0),
          approvedDays: Number(request.approved_days || 0),
          employeeComment: request.employee_comment,
          resolvedAt: request.boss_reviewed_at || request.updated_at || null,
          timingLabel: this.getTimingLabel(request.start_date),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending: pendingCount,
        requestedDays: Number(pendingDaysRaw?.totalDays || 0),
        approved: approvedCount,
        rejected: rejectedCount,
        total: pendingCount + approvedCount + rejectedCount,
      },
    };
  }

  async create(dto: CreateVacationRequestDto, users: any) {
    if (!dto.days || dto.days.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un día');
    }

    const sortedDays = [...new Set(dto.days)].sort();
    const approval = await this.approvalRoutingService.resolve(
      dto.employee_id,
      dto.area_id,
    );
    const areaApproval = await this.approvalRoutingService.resolveAreaOrMainManager(
      dto.employee_id,
      approval.areaId,
      approval.regionalId,
    );
    const requiresRegionalReview = approval.scope === 'REGIONAL';

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = queryRunner.manager.create(VacationRequest, {
        employee_id: dto.employee_id,
        // Persist the area resolved from the current active job record, not the
        // potentially stale area carried by the app session/JWT.
        area_id: approval.areaId,
        regional_id: approval.regionalId,
        approval_scope: approval.scope,
        start_date: sortedDays[0],
        end_date: sortedDays[sortedDays.length - 1],
        requested_days: sortedDays.length,
        approved_days: 0,
        employee_comment: dto.employee_comment ?? null,
        stage: VacationRequestStage.BOSS_REVIEW,
        status: VacationRequestStatus.PENDING,
        boss_employee_id: approval.employeeId,
        boss_status: VacationRequestStatus.PENDING,
        regional_manager_employee_id: requiresRegionalReview
          ? approval.employeeId
          : null,
        regional_status: requiresRegionalReview ? 'PENDING' : null,
        regional_observation: null,
        regional_reviewed_at: null,
        area_manager_employee_id: areaApproval.employeeId,
        hr_status: VacationRequestStatus.PENDING,
        liaison_regional_id: null,
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

      const formatted = sortedDays
        .map((date) => {
          const [year, month, day] = date.split('-');
          return `${day}-${month}-${year}`;
        })
        .join(', ');

      await queryRunner.commitTransaction();

      await this.sendMailToApprover(
        approval.employee,
        users,
        formatted,
        dto.days.length,
        dto.employee_comment,
        savedRequest.id,
      );

      return this.findOne(savedRequest.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async testEndpoint(dto: CreateVacationRequestDto, users: any) {
    const sortedDays = [...new Set(dto.days)].sort();
    const formatted = sortedDays
      .map((date) => {
        const [year, month, day] = date.split('-');
        return `${day}-${month}-${year}`;
      })
      .join(', ');

    const approval = await this.approvalRoutingService.resolve(
      dto.employee_id,
      dto.area_id,
    );

    return this.sendMailToApprover(
      approval.employee,
      users,
      formatted,
      dto.days.length,
      dto.employee_comment,
      'd41547b9-9041-433d-a6cb-91ad89080092',
    );
  }

  async sendMailToApprover(
    bossEmployee: Employee,
    users: any,
    formatted: string,
    requestedDays: number,
    comment: string = '',
    id_request: string,
  ) {
    if (bossEmployee) {
      await sendVacations(
        bossEmployee.email,
        `Se requiere su aprobación para una solicitud de vacaciones de ${users.employees.firstName} ${users.employees.lastName}`,
        `${bossEmployee.firstName} ${bossEmployee.lastName}`,
        `${users.employees.names} ${users.employees.surname}`,
        formatted,
        `${requestedDays}`,
        comment,
        `https://sigerh.senasa.gob.hn/private/autorizations/boos/${id_request}/approved`,
        `https://sigerh.senasa.gob.hn/private/autorizations/boos/${id_request}/rejected`,
      );

      return {
        ok: true,
        message: '',
      };
    } else {
      throw new BadRequestException('No hay aprobador para este empleado');
    }
  }

  async bossReview(
    id: string,
    dto: ReviewVacationRequestDto,
    bossEmployeeId: string,
  ) {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: { employee: true },
    });

    if (!request) {
      throw new NotFoundException('Solicitud de vacaciones no encontrada');
    }

    if (request.boss_employee_id !== bossEmployeeId) {
      throw new ForbiddenException(
        'No tienes autorización para revisar esta solicitud',
      );
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
    // Compatibility for regional requests created before this flow existed.
    // Initialize both reviewers when the first pending reviewer opens it.
    if (
      request.approval_scope === 'REGIONAL' &&
      !request.regional_manager_employee_id &&
      request.stage === VacationRequestStage.BOSS_REVIEW
    ) {
      const areaApproval = await this.approvalRoutingService.resolveAreaOrMainManager(
        request.employee_id,
        request.area_id,
        request.regional_id!,
      );
      request.regional_manager_employee_id = bossEmployeeId;
      request.regional_status = 'PENDING';
      request.area_manager_employee_id = areaApproval.employeeId;
    }
    const isRegionalStep =
      request.approval_scope === 'REGIONAL' &&
      request.regional_manager_employee_id === bossEmployeeId &&
      request.regional_status === 'PENDING';

    if (isRegionalStep) {
      request.regional_status = dto.status;
      request.regional_observation = dto.observation ?? null;
      request.regional_reviewed_at = new Date();
    } else {
      request.boss_status = dto.status;
      request.boss_observation = dto.observation ?? null;
      request.boss_reviewed_at = new Date();
    }

    if (dto.status === VacationRequestStatus.APPROVED) {
      request.status = VacationRequestStatus.PENDING;
      if (isRegionalStep) {
        if (!request.area_manager_employee_id) {
          throw new BadRequestException('La solicitud no tiene jefe de área asignado.');
        }
        request.boss_employee_id = request.area_manager_employee_id;
        request.boss_status = VacationRequestStatus.PENDING;
        request.boss_observation = null;
        request.boss_reviewed_at = null;
        request.stage = VacationRequestStage.BOSS_REVIEW;
      } else {
        request.stage = VacationRequestStage.HR_REVIEW;
        await this.prepareLiaisonReview(request);
      }
    }

    if (dto.status === VacationRequestStatus.REJECTED) {
      request.stage = VacationRequestStage.COMPLETED;
      request.status = VacationRequestStatus.REJECTED;
    }

    const savedRequest = await this.vacationRequestRepository.save(request);
    await this.notifyVacationStatus(
      savedRequest.employee,
      dto.status,
      dto.status === VacationRequestStatus.APPROVED
        ? isRegionalStep
          ? 'El jefe regional aprobó la solicitud y fue enviada al jefe del área asignada.'
          : 'Su jefe aprobó la solicitud y fue enviada al enlace de Recursos Humanos.'
        : 'Su jefe denegó la solicitud de vacaciones.',
      dto.observation,
    );

    return savedRequest;
  }

  async findLiaisonInbox(currentEmployeeId: string) {
    const access = await this.regionalManagerService.getHrLiaisonAccess(currentEmployeeId);
    const regionalIds = access.assignments.filter((item) => item.permissions.vacations).map((item) => item.regionalId);
    if (!regionalIds.length) return [];
    const requests = await this.vacationRequestRepository.find({
      where: regionalIds.map((regionalId) => ({
        liaison_regional_id: regionalId,
        stage: VacationRequestStage.HR_REVIEW,
        status: VacationRequestStatus.PENDING,
        liaison_review_required: true,
        liaison_status: 'PENDING',
      })),
      relations: { employee: true, area: true },
      order: { created_at: 'DESC' },
    });
    return requests.map((request) => ({
      id: request.id,
      requestType: 'vacation',
      employeeName: this.employeeName(request.employee),
      areaName: request.area?.name || 'Sin área',
      regionalId: request.liaison_regional_id || request.regional_id,
      startDate: request.start_date,
      endDate: request.end_date,
      days: Number(request.requested_days),
      reason: request.employee_comment,
      canApproveFinally: false,
      createdAt: request.created_at,
    }));
  }

  async liaisonReview(id: string, dto: ReviewVacationRequestDto, currentEmployeeId: string) {
    const request = await this.vacationRequestRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!request || request.stage !== VacationRequestStage.HR_REVIEW || request.liaison_status !== 'PENDING') {
      throw new BadRequestException('La solicitud ya no está pendiente del enlace de RR. HH.');
    }
    await this.assertLiaisonPermission(
      currentEmployeeId,
      request.liaison_regional_id || request.regional_id!,
      'vacations',
    );
    request.liaison_employee_id = currentEmployeeId;
    request.liaison_status = dto.status;
    request.liaison_observation = dto.observation ?? null;
    request.liaison_reviewed_at = new Date();
    if (dto.status === VacationRequestStatus.REJECTED) {
      request.stage = VacationRequestStage.COMPLETED;
      request.status = VacationRequestStatus.REJECTED;
    }
    const saved = await this.vacationRequestRepository.save(request);
    await this.notifyVacationStatus(request.employee, dto.status,
      dto.status === VacationRequestStatus.APPROVED
        ? 'El enlace regional de Recursos Humanos revisó favorablemente su solicitud. Continúa a RR. HH. central.'
        : 'El enlace regional de Recursos Humanos denegó su solicitud.', dto.observation);
    return saved;
  }

  private async prepareLiaisonReview(request: VacationRequest) {
    if (!request.regional_id) return;
    let liaisons = await this.regionalManagerService.findActiveHrLiaisonsByPermission(request.regional_id, 'vacations');
    if (!liaisons.length) {
      liaisons = await this.regionalManagerService.findMainOfficeHrLiaisonsByPermission('vacations');
    }
    request.liaison_review_required = liaisons.length > 0;
    request.liaison_status = liaisons.length ? 'PENDING' : null;
    request.liaison_regional_id = liaisons[0]?.regional_id || null;
  }

  private async assertLiaisonPermission(employeeId: string, regionalId: string, permission: 'vacations' | 'exit_permits' | 'leaves') {
    const liaisons = await this.regionalManagerService.findActiveHrLiaisonsByPermission(regionalId, permission);
    if (!liaisons.some((item) => item.employee_id === employeeId)) throw new ForbiddenException('No tiene permiso de enlace para revisar esta solicitud.');
  }

  private employeeName(employee?: Employee | null) {
    return [employee?.firstName, employee?.middleName, employee?.lastName, employee?.secondLastName].filter(Boolean).join(' ') || 'Empleado';
  }

  private applyBossOwnershipFilter(
    query: any,
    currentEmployeeId: string,
  ) {
    return query.andWhere(
      'request.boss_employee_id = :currentEmployeeId',
      { currentEmployeeId },
    );
  }

  async hrReview(
    id: string,
    dto: ReviewVacationRequestDto,
    hrEmployeeId: string,
  ) {
    const request = await this.vacationRequestRepository.findOne({
      where: { id },
      relations: ['days', 'employee'],
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

      const savedRequest = await this.vacationRequestRepository.save(request);
      await this.notifyVacationStatus(
        savedRequest.employee,
        dto.status,
        'Recursos Humanos denegó su solicitud de vacaciones.',
        dto.observation,
      );
      return savedRequest;
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

      await this.notifyVacationStatus(
        request.employee,
        VacationRequestStatus.APPROVED,
        'Recursos Humanos aprobó definitivamente su solicitud de vacaciones.',
        dto.observation,
      );

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

  private async notifyVacationStatus(
    employee: Employee,
    status: VacationRequestStatus,
    message: string,
    observation?: string,
  ) {
    const employeeName = [
      employee?.firstName,
      employee?.middleName,
      employee?.lastName,
      employee?.secondLastName,
    ]
      .filter(Boolean)
      .join(' ') || 'Empleado';

    await sendRequestNotification(
      employee?.email,
      `Solicitud de vacaciones ${
        status === VacationRequestStatus.APPROVED ? 'aprobada' : 'denegada'
      }`,
      employeeName,
      message,
      observation ? [`Observación: ${observation}`] : [],
    );
  }

  private applyHrInboxStatusFilter(
    query: any,
    status: string,
    currentEmployeeId: string,
  ) {
    switch (status) {
      case 'approved':
        return query
          .andWhere('request.hr_status = :approvedStatus', {
            approvedStatus: VacationRequestStatus.APPROVED,
          })
          .andWhere('request.stage = :completedStage', {
            completedStage: VacationRequestStage.COMPLETED,
          });
      case 'rejected':
        return query
          .andWhere('request.hr_status = :rejectedStatus', {
            rejectedStatus: VacationRequestStatus.REJECTED,
          })
          .andWhere('request.stage = :completedStage', {
            completedStage: VacationRequestStage.COMPLETED,
          });
      case 'all':
        return query.andWhere('request.hr_status IN (:...hrStatuses)', {
          hrStatuses: [
            VacationRequestStatus.PENDING,
            VacationRequestStatus.APPROVED,
            VacationRequestStatus.REJECTED,
          ],
        });
      case 'pending':
      default:
        return query
          .andWhere('request.hr_status = :pendingStatus', {
            pendingStatus: VacationRequestStatus.PENDING,
          })
          .andWhere('request.stage = :hrStage', {
            hrStage: VacationRequestStage.HR_REVIEW,
          });
    }
  }

  private applyBossInboxStatusFilter(query: any, status: string) {
    switch (status) {
      case 'approved':
        return query.andWhere('request.boss_status = :approvedStatus', {
          approvedStatus: VacationRequestStatus.APPROVED,
        });
      case 'rejected':
        return query.andWhere('request.boss_status = :rejectedStatus', {
          rejectedStatus: VacationRequestStatus.REJECTED,
        });
      case 'all':
        return query.andWhere('request.boss_status IN (:...bossStatuses)', {
          bossStatuses: [
            VacationRequestStatus.PENDING,
            VacationRequestStatus.APPROVED,
            VacationRequestStatus.REJECTED,
          ],
        });
      case 'pending':
      default:
        return query
          .andWhere('request.boss_status = :pendingStatus', {
            pendingStatus: VacationRequestStatus.PENDING,
          })
          .andWhere('request.stage = :bossStage', {
            bossStage: VacationRequestStage.BOSS_REVIEW,
          });
    }
  }

  private getTimingLabel(startDate: string) {
    const today = this.formatDate(new Date());

    if (startDate < today) {
      return 'Pasada';
    }

    const diffMs = new Date(startDate).getTime() - new Date(today).getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      return 'En 1 día';
    }

    return `En ${diffDays} días`;
  }
}
