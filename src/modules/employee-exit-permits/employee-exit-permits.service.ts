import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';

import { EmployeeExitPermit } from './entities/employee-exit-permit.entity';

import { CreateEmployeeExitPermitDto } from './dto/create-employee-exit-permit.dto';
import { ListHrExitPermitsDto } from './dto/list-hr-exit-permits.dto';
import { ReviewEmployeeExitPermitDto } from './dto/review-employee-exit-permit.dto';

import { ApprovalRoutingService } from '../area-manager/approval-routing.service';
import { AreaManagerService } from '../area-manager/area-manager.service';
import { AreaManagerRole } from '../area-manager/interfaces/area-manager-role.enum';
import { ExitPermitStage } from './enums/exit-permit-stage.enum';
import { ExitPermitStatus } from './enums/exit-permit-status.enum';
import { Employee } from '../employees/entities/employee.entity';
import { sendRequestNotification } from '../../common/helpers/send-email.helper';
import { StorageService } from '../../common/services/storage.service';
import { RegionalManagerService } from '../area-manager/regional-manager.service';
import { PrinterService } from '../../common/printer/printer.service';
import { buildEmployeeExitPermitReport } from './reports/employee-exit-permit.report';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';

@Injectable()
export class EmployeeExitPermitsService {
  constructor(
    @InjectRepository(EmployeeExitPermit)
    private readonly exitPermitRepository: Repository<EmployeeExitPermit>,

    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,

    private readonly areaManagersService: AreaManagerService,
    private readonly approvalRoutingService: ApprovalRoutingService,
    private readonly storageService: StorageService,
    private readonly regionalManagerService: RegionalManagerService,
    private readonly printerService: PrinterService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async generatePdf(id: string, currentEmployeeId: string) {
    const permit = await this.exitPermitRepository.findOne({
      where: { id },
      relations: { employee: true, area: true, boss_employee: true, hr_employee: true },
    });

    if (!permit) throw new NotFoundException('Solicitud de salida no encontrada');
    if (!currentEmployeeId) throw new ForbiddenException('No fue posible identificar al usuario');

    return {
      pdf: this.printerService.createPdf(buildEmployeeExitPermitReport(permit)),
      fileName: `pase-salida-${permit.id.slice(0, 8)}.pdf`,
    };
  }

  async findHrInbox(params: ListHrExitPermitsDto, currentEmployeeId: string) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 6, 1), 24);
    const status = params.status || 'pending';

    const query = this.exitPermitRepository
      .createQueryBuilder('permit')
      .leftJoinAndSelect('permit.employee', 'employee')
      .leftJoinAndSelect('permit.area', 'area')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )
      .where('permit.boss_status = :bossApproved', {
        bossApproved: ExitPermitStatus.APPROVED,
      })
      .andWhere('(permit.liaison_review_required = false OR permit.liaison_status = :liaisonApproved OR permit.status <> :liaisonPending)', {
        liaisonApproved: ExitPermitStatus.APPROVED,
        liaisonPending: ExitPermitStatus.PENDING,
      });

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(permit.description) LIKE :search', { search });
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

    this.applyHrStatusFilter(query, status);

    query
      .addSelect(
        `CASE
          WHEN permit.hr_status = '${ExitPermitStatus.PENDING}' THEN 0
          WHEN permit.hr_status = '${ExitPermitStatus.APPROVED}' THEN 1
          ELSE 2
        END`,
        'hr_status_order',
      )
      .orderBy('hr_status_order', 'ASC')
      .addOrderBy('permit.exit_date', 'DESC')
      .addOrderBy('permit.exit_time', 'DESC')
      .addOrderBy('permit.created_at', 'DESC');

    const [permits, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsBaseQuery = this.exitPermitRepository
      .createQueryBuilder('permit')
      .where('permit.boss_status = :bossApproved', {
        bossApproved: ExitPermitStatus.APPROVED,
      })
      .andWhere('(permit.liaison_review_required = false OR permit.liaison_status = :liaisonApproved OR permit.status <> :liaisonPending)', {
        liaisonApproved: ExitPermitStatus.APPROVED,
        liaisonPending: ExitPermitStatus.PENDING,
      });

    const [pending, approved, rejected] = await Promise.all([
      this.applyHrStatusFilter(statsBaseQuery.clone(), 'pending').getCount(),
      this.applyHrStatusFilter(statsBaseQuery.clone(), 'approved').getCount(),
      this.applyHrStatusFilter(statsBaseQuery.clone(), 'rejected').getCount(),
    ]);

    return {
      data: permits.map((permit) => {
        const employee = permit.employee;
        const currentRecord = employee?.jobRecords?.find(
          (record) => String(record.status || '').toLowerCase() === 'active',
        );
        const fullName = [
          employee?.firstName,
          employee?.middleName,
          employee?.lastName,
          employee?.secondLastName,
        ]
          .filter(Boolean)
          .join(' ');
        const reviewedAt = permit.hr_reviewed_at || permit.updated_at || null;

        return {
          id: permit.id,
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
          departmentName:
            currentRecord?.area?.name ||
            permit.area?.name ||
            'Sin área asignada',
          status: permit.hr_status,
          stage: permit.stage,
          exitDate: permit.exit_date,
          endDate: permit.end_date,
          exitTime: permit.exit_time,
          returnTime: permit.return_time,
          withoutReturn: permit.without_return,
          description: permit.description,
          resolvedAt: reviewedAt,
          typeLabel: permit.permit_type || 'Personal',
          durationMinutes: this.getDurationInMinutes(
            permit.exit_time,
            permit.return_time,
          ),
          personalDuration: permit.personal_duration,
          hasSupport: Boolean(permit.support_file_path),
          documentsComplete:
            this.isPersonalPermit(permit.permit_type) ||
            Boolean(permit.support_file_path),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending,
        approved,
        rejected,
        total: pending + approved + rejected,
      },
    };
  }

  async findBossInbox(params: ListHrExitPermitsDto, currentEmployeeId: string) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 6, 1), 24);
    const status = params.status || 'pending';

    const query = this.exitPermitRepository
      .createQueryBuilder('permit')
      .leftJoinAndSelect('permit.employee', 'employee')
      .leftJoinAndSelect('permit.area', 'area')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      );

    this.applyBossOwnershipFilter(query, currentEmployeeId);

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(permit.description) LIKE :search', { search });
          qb.orWhere("LOWER(COALESCE(permit.permit_type, '')) LIKE :search", {
            search,
          });
          qb.orWhere('LOWER(employee.firstName) LIKE :search', { search });
          qb.orWhere("LOWER(COALESCE(employee.middleName, '')) LIKE :search", {
            search,
          });
          qb.orWhere('LOWER(employee.lastName) LIKE :search', { search });
          qb.orWhere(
            "LOWER(COALESCE(employee.secondLastName, '')) LIKE :search",
            { search },
          );
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

    this.applyBossStatusFilter(query, status);

    query
      .addSelect(
        `CASE
          WHEN permit.boss_status = '${ExitPermitStatus.PENDING}' THEN 0
          WHEN permit.boss_status = '${ExitPermitStatus.APPROVED}' THEN 1
          ELSE 2
        END`,
        'boss_status_order',
      )
      .orderBy('boss_status_order', 'ASC')
      .addOrderBy('permit.exit_date', 'DESC')
      .addOrderBy('permit.exit_time', 'DESC')
      .addOrderBy('permit.created_at', 'DESC');

    const [permits, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsBaseQuery =
      this.exitPermitRepository.createQueryBuilder('permit');

    this.applyBossOwnershipFilter(statsBaseQuery, currentEmployeeId);

    const [pending, approved, rejected] = await Promise.all([
      this.applyBossStatusFilter(statsBaseQuery.clone(), 'pending').getCount(),
      this.applyBossStatusFilter(statsBaseQuery.clone(), 'approved').getCount(),
      this.applyBossStatusFilter(statsBaseQuery.clone(), 'rejected').getCount(),
    ]);

    return {
      data: permits.map((permit) =>
        this.mapExitPermitInboxItem(permit, 'boss'),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending,
        approved,
        rejected,
        total: pending + approved + rejected,
      },
    };
  }

  async findMine(currentEmployeeId: string) {
    const permits = await this.exitPermitRepository.find({
      where: { employee_id: currentEmployeeId },
      order: { created_at: 'DESC' },
    });
    return permits.map((permit) => ({
      id: permit.id,
      permitType: permit.permit_type,
      exitDate: permit.exit_date,
      endDate: permit.end_date || permit.exit_date,
      exitTime: permit.exit_time,
      returnTime: permit.return_time,
      withoutReturn: permit.without_return,
      description: permit.description,
      stage: permit.stage,
      status: permit.status,
      bossStatus: permit.boss_status,
      hrStatus: permit.hr_status,
      hasSupport: Boolean(permit.support_file_path),
      documentsComplete: this.isPersonalPermit(permit.permit_type) || Boolean(permit.support_file_path),
      canCompleteDocuments: permit.stage !== ExitPermitStage.COMPLETED,
      createdAt: permit.created_at,
    }));
  }

  async findBossDetail(id: string, currentEmployeeId: string) {
    const permit = await this.exitPermitRepository.findOne({
      where: { id },
      relations: {
        employee: { jobRecords: { area: true, position: true, functionalPosition: true } },
        area: true,
      },
    });
    if (!permit) {
      throw new NotFoundException('Solicitud de salida no encontrada');
    }

    const ownsAssignedRequest = permit.boss_employee_id === currentEmployeeId;
    if (!ownsAssignedRequest) {
      throw new ForbiddenException('No tienes permiso para consultar esta solicitud');
    }

    return this.mapExitPermitInboxItem(permit, 'boss');
  }

  async create(dto: CreateEmployeeExitPermitDto) {
    const minimumRequestDate = this.minimumRetroactiveDate();
    if (dto.exit_date < minimumRequestDate) {
      throw new BadRequestException(
        'Los pases de salida solo pueden solicitarse hasta 10 días calendario hacia atrás',
      );
    }
    const approval = await this.approvalRoutingService.resolve(
      dto.employee_id,
      dto.area_id,
    );

    if (dto.without_return && dto.return_time) {
      throw new BadRequestException(
        'Si la salida es sin retorno, no debe enviar hora de retorno',
      );
    }

    if (!dto.without_return && !dto.return_time) {
      throw new BadRequestException(
        'Debe enviar hora de retorno o marcar la salida como sin retorno',
      );
    }

    const isPersonal = this.isPersonalPermit(dto.permit_type);
    const endDate = dto.end_date || dto.exit_date;
    if (endDate < dto.exit_date) {
      throw new BadRequestException('La fecha final no puede ser anterior a la fecha de salida');
    }
    if (isPersonal && endDate !== dto.exit_date) {
      throw new BadRequestException('Los pases personales solo pueden solicitarse para un día');
    }
    const employeeScheduleEnd = isPersonal
      ? await this.getEmployeeScheduleEnd(dto.employee_id)
      : undefined;
    const personalDuration = isPersonal
      ? this.classifyPersonalPermit(dto.exit_time, dto.return_time, Boolean(dto.without_return), employeeScheduleEnd)
      : null;
    if (isPersonal) await this.validatePersonalMonthlyQuota(dto.employee_id, dto.exit_date, personalDuration!, employeeScheduleEnd);

    const supportMimeType = this.validateSupportImage(dto.base64FileFoto);

    const exitPermit = this.exitPermitRepository.create({
      employee_id: dto.employee_id,
      // The JWT/app may contain an old department after a job transfer. Always
      // persist the authoritative area from the active job record resolution.
      area_id: approval.areaId,
      regional_id: approval.regionalId,
      approval_scope: approval.scope,
      description: dto.description,
      permit_type: dto.permit_type,
      exit_date: dto.exit_date as any,
      end_date: endDate as any,
      exit_time: dto.exit_time,
      return_time: dto.without_return ? null : dto.return_time,
      without_return: dto.without_return ?? false,
      personal_duration: personalDuration,
      support_file_path: null,
      support_mime_type: null,

      stage: ExitPermitStage.BOSS_REVIEW,
      status: ExitPermitStatus.PENDING,

      boss_employee_id: approval.employeeId,
      boss_status: ExitPermitStatus.PENDING,
      hr_status: ExitPermitStatus.PENDING,
    });

    const savedPermit = await this.exitPermitRepository.save(exitPermit);
    if (dto.base64FileFoto) {
      const extension = supportMimeType === 'application/pdf' ? 'pdf' : supportMimeType === 'image/png' ? 'png' : supportMimeType === 'image/webp' ? 'webp' : 'jpg';
      savedPermit.support_file_path = this.storageService.saveBase64File(
        dto.base64FileFoto,
        `exit-permits/${savedPermit.id}`,
        `support.${extension}`,
      );
      savedPermit.support_mime_type = supportMimeType;
      await this.exitPermitRepository.save(savedPermit);
    }
    const requester = await this.employeeRepository.findOneBy({ id: dto.employee_id });

    await sendRequestNotification(
      approval.employee.email,
      `Nuevo pase de salida de ${this.employeeName(requester)}`,
      this.employeeName(approval.employee),
      'Tiene un pase de salida pendiente de revisión.',
      [
        `Empleado: ${this.employeeName(requester)}`,
        `Fecha: ${dto.exit_date}`,
        `Hora: ${dto.exit_time}`,
        `Motivo: ${dto.description}`,
      ],
      'https://sigerh.senasa.gob.hn/exit-permit-requests/pending',
    );
    await this.pushNotifications.sendToEmployee(
      approval.employeeId,
      'Nuevo pase de salida',
      `${this.employeeName(requester)} envió un pase pendiente de revisión.`,
      `/exit-permit-detail/${savedPermit.id}/approved`,
    );

    return savedPermit;
  }

  private classifyPersonalPermit(
    exitTime: string,
    returnTime?: string,
    withoutReturn = false,
    scheduleEndTime?: string,
  ): 'HALF' | 'FULL' {
    const effectiveReturnTime = withoutReturn ? scheduleEndTime : returnTime;
    if (!effectiveReturnTime) return 'FULL';
    const exitMinutes = this.timeToMinutes(exitTime);
    const returnMinutes = this.timeToMinutes(effectiveReturnTime);
    if (returnMinutes <= exitMinutes) throw new BadRequestException('La hora de retorno debe ser mayor a la hora de salida');
    const duration = returnMinutes - exitMinutes;
    const staysInMorning = returnMinutes <= 12 * 60;
    const staysInAfternoon = exitMinutes >= 12 * 60;
    return duration <= 4 * 60 && (staysInMorning || staysInAfternoon)
      ? 'HALF'
      : 'FULL';
  }

  private minimumRetroactiveDate() {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - 10);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private async validatePersonalMonthlyQuota(
    employeeId: string,
    exitDate: string,
    requested: 'HALF' | 'FULL',
    scheduleEndTime?: string,
  ) {
    const monthStart = `${exitDate.slice(0, 7)}-01`;
    const date = new Date(`${monthStart}T12:00:00`);
    date.setMonth(date.getMonth() + 1);
    const nextMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const monthlyRecords = await this.exitPermitRepository
      .createQueryBuilder('permit')
      .where('permit.employee_id = :employeeId', { employeeId })
      .andWhere('LOWER(TRIM(permit.permit_type)) = :personalType', {
        personalType: 'personal',
      })
      .andWhere('permit.exit_date >= :monthStart', { monthStart })
      .andWhere('permit.exit_date < :nextMonth', { nextMonth })
      .getMany();

    // A denial at any level releases the monthly quota. Filter in application
    // code because PostgreSQL stores every status column as a different ENUM,
    // and old rows may have a rejected reviewer while the global status stayed
    // pending. Legacy cancellation spellings are accepted as well.
    const rejectedValues = new Set([
      ExitPermitStatus.REJECTED,
      'cancelled',
      'canceled',
      'cancelado',
      'denied',
    ]);
    const monthly = monthlyRecords.filter((permit) =>
      ![
        permit.status,
        permit.boss_status,
        permit.hr_status,
        permit.liaison_status,
      ].some((status) => rejectedValues.has(String(status || '').toLowerCase())),
    );

    // Recalculate legacy rows using their actual schedule. Older versions only
    // recognized the morning window and stored afternoon half-days as FULL.
    const monthlyDurations = monthly.map((permit) =>
      this.classifyPersonalPermit(
        permit.exit_time,
        permit.return_time ?? undefined,
        permit.without_return,
        scheduleEndTime,
      ),
    );
    const allCalculatedDurations = monthlyRecords.map((permit) =>
      this.classifyPersonalPermit(
        permit.exit_time,
        permit.return_time ?? undefined,
        permit.without_return,
        scheduleEndTime,
      ),
    );
    const correctedPermits = monthlyRecords.filter(
      (permit, index) => permit.personal_duration !== allCalculatedDurations[index],
    );
    if (correctedPermits.length) {
      correctedPermits.forEach((permit) => {
        const index = monthlyRecords.indexOf(permit);
        permit.personal_duration = allCalculatedDurations[index];
      });
      await this.exitPermitRepository.save(correctedPermits);
    }

    if (requested === 'FULL' && monthlyDurations.length) {
      throw new BadRequestException('Ya utilizó parte del cupo personal de este mes. Solo se permite un pase completo o dos medios días.');
    }
    if (requested === 'HALF' && (monthlyDurations.some((duration) => duration !== 'HALF') || monthlyDurations.filter((duration) => duration === 'HALF').length >= 2)) {
      throw new BadRequestException('Ya alcanzó el límite mensual de pases personales.');
    }
  }

  private async getEmployeeScheduleEnd(employeeId: string) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: { schedule: true },
    });
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return employee.schedule?.endTime || undefined;
  }

  private validateSupportImage(base64?: string) {
    if (!base64) return null;
    const match = base64.match(/^data:(application\/pdf|image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) throw new BadRequestException('El respaldo debe ser un documento PDF o una imagen JPG, PNG o WEBP');
    if (Buffer.byteLength(match[2], 'base64') > 10 * 1024 * 1024) throw new BadRequestException('El documento de respaldo debe pesar 10 MB o menos');
    return match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) throw new BadRequestException('Horario inválido');
    return hours * 60 + minutes;
  }

  async reviewByBoss(
    id: string,
    dto: ReviewEmployeeExitPermitDto,
    currentEmployeeId: string,
  ) {
    const exitPermit = await this.exitPermitRepository.findOne({
      where: { id },
      relations: { employee: true, area: true, boss_employee: true },
    });

    if (!exitPermit) {
      throw new NotFoundException('Solicitud de salida no encontrada');
    }

    if (exitPermit.stage !== ExitPermitStage.BOSS_REVIEW) {
      throw new BadRequestException(
        'Esta solicitud no está en etapa de revisión del jefe',
      );
    }

    if (exitPermit.boss_employee_id !== currentEmployeeId) {
      throw new ForbiddenException(
        'No tienes permiso para revisar esta solicitud',
      );
    }

    exitPermit.boss_status = dto.status;
    exitPermit.boss_observation = dto.observation ?? null;
    exitPermit.boss_reviewed_at = new Date();

    if (dto.status === ExitPermitStatus.APPROVED) {
      exitPermit.stage = ExitPermitStage.HR_REVIEW;
      exitPermit.status = ExitPermitStatus.PENDING;
      await this.prepareLiaisonReview(exitPermit);
    }

    if (dto.status === ExitPermitStatus.REJECTED) {
      exitPermit.stage = ExitPermitStage.COMPLETED;
      exitPermit.status = ExitPermitStatus.REJECTED;
    }

    const savedPermit = await this.exitPermitRepository.save(exitPermit);
    await this.notifyEmployeeOfStatus(
      savedPermit.employee,
      'pase de salida',
      dto.status,
      dto.status === ExitPermitStatus.APPROVED
        ? 'Su jefe aprobó la solicitud y fue enviada a Recursos Humanos para la revisión final.'
        : 'Su jefe denegó la solicitud.',
      dto.observation,
    );

    return savedPermit;
  }

  async findLiaisonInbox(currentEmployeeId: string) {
    const access = await this.regionalManagerService.getHrLiaisonAccess(currentEmployeeId);
    const regionalIds = access.assignments.filter((item) => item.permissions.exitPermits).map((item) => item.regionalId);
    if (!regionalIds.length) return [];
    const permits = await this.exitPermitRepository.find({
      where: regionalIds.map((regionalId) => ({
        regional_id: regionalId,
        stage: ExitPermitStage.HR_REVIEW,
        status: ExitPermitStatus.PENDING,
        liaison_review_required: true,
        liaison_status: 'pending',
      })),
      relations: { employee: true, area: true },
      order: { created_at: 'DESC' },
    });
    return permits.map((permit) => ({
      id: permit.id,
      requestType: 'exit_permit',
      employeeName: this.employeeName(permit.employee),
      employeeCode: permit.employee?.biometric_id
        ? `EMP-${String(permit.employee.biometric_id).padStart(4, '0')}`
        : `EMP-${permit.employee_id.slice(0, 4).toUpperCase()}`,
      employeeInitials: `${permit.employee?.firstName?.[0] || ''}${permit.employee?.lastName?.[0] || ''}`.toUpperCase(),
      areaName: permit.area?.name || 'Sin área',
      regionalId: permit.regional_id,
      startDate: permit.exit_date,
      endDate: permit.end_date || permit.exit_date,
      exitTime: permit.exit_time,
      returnTime: permit.return_time,
      withoutReturn: permit.without_return,
      durationMinutes: this.getDurationInMinutes(
        permit.exit_time,
        permit.return_time,
      ),
      reason: permit.description,
      permitType: permit.permit_type,
      hasSupport: Boolean(permit.support_file_path),
      documentsComplete: this.isPersonalPermit(permit.permit_type) || Boolean(permit.support_file_path),
      canApproveFinally: !access.assignments.find((item) => item.regionalId === permit.regional_id)?.isMainOffice,
      createdAt: permit.created_at,
    }));
  }

  async liaisonReview(id: string, dto: ReviewEmployeeExitPermitDto, currentEmployeeId: string) {
    const permit = await this.exitPermitRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!permit || permit.stage !== ExitPermitStage.HR_REVIEW || permit.liaison_status !== 'pending') {
      throw new BadRequestException('El pase ya no está pendiente del enlace de RR. HH.');
    }
    const liaison = await this.assertLiaisonPermission(currentEmployeeId, permit.regional_id!);
    if (dto.status === ExitPermitStatus.APPROVED && !this.isPersonalPermit(permit.permit_type) && !permit.support_file_path) {
      throw new BadRequestException('No puede procesar el pase hasta que el empleado complete los documentos.');
    }
    permit.liaison_employee_id = currentEmployeeId;
    permit.liaison_status = dto.status;
    permit.liaison_observation = [permit.liaison_observation, dto.observation?.trim()].filter(Boolean).join('\n') || null;
    permit.liaison_reviewed_at = new Date();
    if (dto.status === ExitPermitStatus.REJECTED) {
      permit.stage = ExitPermitStage.COMPLETED;
      permit.status = ExitPermitStatus.REJECTED;
    } else if (!liaison.regional?.is_main_office) {
      permit.stage = ExitPermitStage.COMPLETED;
      permit.status = ExitPermitStatus.APPROVED;
      permit.hr_status = ExitPermitStatus.APPROVED;
      permit.hr_employee_id = currentEmployeeId;
      permit.hr_reviewed_at = new Date();
    }
    const saved = await this.exitPermitRepository.save(permit);
    await this.notifyEmployeeOfStatus(permit.employee, 'pase de salida', dto.status,
      dto.status === ExitPermitStatus.REJECTED
        ? 'El enlace regional de Recursos Humanos denegó su pase de salida.'
        : liaison.regional?.is_main_office
          ? 'El enlace de Recursos Humanos revisó favorablemente su pase. Continúa a aprobación central.'
          : 'El enlace regional de Recursos Humanos aprobó definitivamente su pase.', dto.observation);
    return saved;
  }

  async requestSupportChange(id: string, observation: string, currentEmployeeId: string) {
    if (!currentEmployeeId) throw new ForbiddenException('No fue posible identificar al enlace.');
    const reason = observation?.trim();
    if (!reason || reason.length > 1000) throw new BadRequestException('Indique un motivo de entre 1 y 1000 caracteres.');
    const permit = await this.exitPermitRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!permit) throw new NotFoundException('Solicitud de salida no encontrada.');
    await this.assertLiaisonPermission(currentEmployeeId, permit.regional_id!);
    if (permit.stage !== ExitPermitStage.HR_REVIEW || permit.status !== ExitPermitStatus.PENDING || !permit.liaison_review_required || permit.liaison_status !== 'pending') {
      throw new BadRequestException('Solo puede solicitar cambios mientras el pase esté pendiente del enlace de RR. HH.');
    }
    if (!permit.support_file_path) throw new BadRequestException('El pase ya está pendiente de que el empleado adjunte un documento.');
    const reviewer = await this.employeeRepository.findOneBy({ id: currentEmployeeId });
    const note = `[${new Date().toISOString()}] Cambio de documento solicitado por ${this.employeeName(reviewer!)}: ${reason}`;
    // Retain the old file for recovery; only detach it from the active request.
    const updated = await this.exitPermitRepository.update({
      id, support_file_path: permit.support_file_path, stage: ExitPermitStage.HR_REVIEW,
      status: ExitPermitStatus.PENDING, liaison_status: 'pending', liaison_review_required: true,
    }, {
      support_file_path: null, support_mime_type: null,
      liaison_observation: [permit.liaison_observation, note].filter(Boolean).join('\n'),
      updated_at: new Date(),
    });
    if (updated.affected !== 1) throw new BadRequestException('El pase cambió durante la revisión. Actualice la bandeja.');
    const title = 'Solicitud de cambio de documento del pase de salida';
    const message = `El enlace de RR. HH. solicita que vuelva a adjuntar el respaldo de su pase de salida. Motivo: ${reason}`;
    const [email, push] = await Promise.allSettled([
      sendRequestNotification(permit.employee?.email, title, this.employeeName(permit.employee), message,
        [`Pase: ${permit.id}`, 'La solicitud sigue pendiente de revisión; no ha sido denegada.'],
        'https://sigerh.senasa.gob.hn/exit-permits/history'),
      this.pushNotifications.sendToEmployee(permit.employee_id, title, message, '/exit-permits/history'),
    ]);
    return {
      id, hasSupport: false,
      documentsComplete: this.isPersonalPermit(permit.permit_type),
      notificationWarning: email.status === 'rejected' || !email.value || push.status === 'rejected',
    };
  }

  private async prepareLiaisonReview(permit: EmployeeExitPermit) {
    if (!permit.regional_id) return;
    const liaisons = await this.regionalManagerService.findActiveHrLiaisonsByPermission(permit.regional_id, 'exit_permits');
    permit.liaison_review_required = liaisons.length > 0;
    permit.liaison_status = liaisons.length ? 'pending' : null;
  }

  private async assertLiaisonPermission(employeeId: string, regionalId: string) {
    const liaisons = await this.regionalManagerService.findActiveHrLiaisonsByPermission(regionalId, 'exit_permits');
    const liaison = liaisons.find((item) => item.employee_id === employeeId);
    if (!liaison) throw new ForbiddenException('No tiene permiso de enlace para revisar este pase.');
    return liaison;
  }

  async getSupport(id: string, currentEmployeeId: string) {
    const permit = await this.exitPermitRepository.findOneBy({ id });
    if (!permit?.support_file_path) throw new NotFoundException('Esta solicitud no tiene imagen de respaldo');
    const canView = permit.employee_id === currentEmployeeId || permit.boss_employee_id === currentEmployeeId || permit.hr_employee_id === currentEmployeeId || permit.stage === ExitPermitStage.HR_REVIEW;
    if (!canView) throw new ForbiddenException('No tiene permiso para consultar este respaldo');
    return { mimeType: permit.support_mime_type || 'image/jpeg', absolutePath: this.storageService.getAbsolutePath(permit.support_file_path) };
  }

  async updateSupport(id: string, base64FileFoto: string, currentEmployeeId: string) {
    const permit = await this.exitPermitRepository.findOneBy({ id });
    if (!permit) throw new NotFoundException('Solicitud de salida no encontrada');
    if (permit.employee_id !== currentEmployeeId) throw new ForbiddenException('Solo el empleado solicitante puede completar los documentos');
    if (permit.stage === ExitPermitStage.COMPLETED) throw new BadRequestException('No puede modificar documentos de una solicitud finalizada');
    const mimeType = this.validateSupportImage(base64FileFoto)!;
    if (permit.support_file_path) this.storageService.deleteFile(permit.support_file_path);
    const extension = mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    permit.support_file_path = this.storageService.saveBase64File(base64FileFoto, `exit-permits/${permit.id}`, `support.${extension}`);
    permit.support_mime_type = mimeType;
    await this.exitPermitRepository.save(permit);
    return { id: permit.id, hasSupport: true, documentsComplete: true };
  }

  private applyBossOwnershipFilter(
    query: any,
    currentEmployeeId: string,
  ) {
    return query.andWhere('permit.boss_employee_id = :currentEmployeeId', {
      currentEmployeeId,
    });
  }

  async reviewByHr(
    id: string,
    dto: ReviewEmployeeExitPermitDto,
    currentEmployeeId: string,
  ) {
    const exitPermit = await this.exitPermitRepository.findOne({
      where: { id },
      relations: { employee: true, area: true, boss_employee: true },
    });

    if (!exitPermit) {
      throw new NotFoundException('Solicitud de salida no encontrada');
    }

    if (exitPermit.stage !== ExitPermitStage.HR_REVIEW) {
      throw new BadRequestException(
        'Esta solicitud no está en etapa de revisión de RRHH',
      );
    }

    if (dto.status === ExitPermitStatus.APPROVED && !this.isPersonalPermit(exitPermit.permit_type) && !exitPermit.support_file_path) {
      throw new BadRequestException('No puede aprobar el pase hasta que el empleado complete los documentos de respaldo');
    }

    exitPermit.hr_status = dto.status;
    exitPermit.hr_employee_id = currentEmployeeId;
    exitPermit.hr_observation = dto.observation ?? null;
    exitPermit.hr_reviewed_at = new Date();

    exitPermit.stage = ExitPermitStage.COMPLETED;

    if (dto.status === ExitPermitStatus.APPROVED) {
      exitPermit.status = ExitPermitStatus.APPROVED;
    }

    if (dto.status === ExitPermitStatus.REJECTED) {
      exitPermit.status = ExitPermitStatus.REJECTED;
    }

    const savedPermit = await this.exitPermitRepository.save(exitPermit);
    const attachments = dto.status === ExitPermitStatus.APPROVED
      ? [
          {
            filename: `pase-salida-${savedPermit.id.slice(0, 8)}.pdf`,
            content: await this.pdfStreamToBuffer(
              this.printerService.createPdf(buildEmployeeExitPermitReport(savedPermit)),
            ),
            contentType: 'application/pdf',
          },
        ]
      : [];
    await this.notifyEmployeeOfStatus(
      savedPermit.employee,
      'pase de salida',
      dto.status,
      dto.status === ExitPermitStatus.APPROVED
        ? 'Recursos Humanos aprobó definitivamente su solicitud.'
        : 'Recursos Humanos denegó su solicitud.',
      dto.observation,
      attachments,
    );

    return savedPermit;
  }

  private applyHrStatusFilter(query: any, status: string) {
    switch (status) {
      case 'approved':
        return query
          .andWhere('permit.hr_status = :approvedStatus', {
            approvedStatus: ExitPermitStatus.APPROVED,
          })
          .andWhere('permit.stage = :completedStage', {
            completedStage: ExitPermitStage.COMPLETED,
          });
      case 'rejected':
        return query
          .andWhere('permit.hr_status = :rejectedStatus', {
            rejectedStatus: ExitPermitStatus.REJECTED,
          })
          .andWhere('permit.stage = :completedStage', {
            completedStage: ExitPermitStage.COMPLETED,
          });
      case 'all':
        return query.andWhere('permit.hr_status IN (:...hrStatuses)', {
          hrStatuses: [
            ExitPermitStatus.PENDING,
            ExitPermitStatus.APPROVED,
            ExitPermitStatus.REJECTED,
          ],
        });
      case 'pending':
      default:
        return query
          .andWhere('permit.hr_status = :pendingStatus', {
            pendingStatus: ExitPermitStatus.PENDING,
          })
          .andWhere('permit.stage = :hrStage', {
            hrStage: ExitPermitStage.HR_REVIEW,
          });
    }
  }

  private applyBossStatusFilter(query: any, status: string) {
    switch (status) {
      case 'approved':
        return query.andWhere('permit.boss_status = :approvedStatus', {
          approvedStatus: ExitPermitStatus.APPROVED,
        });
      case 'rejected':
        return query.andWhere('permit.boss_status = :rejectedStatus', {
          rejectedStatus: ExitPermitStatus.REJECTED,
        });
      case 'all':
        return query.andWhere('permit.boss_status IN (:...bossStatuses)', {
          bossStatuses: [
            ExitPermitStatus.PENDING,
            ExitPermitStatus.APPROVED,
            ExitPermitStatus.REJECTED,
          ],
        });
      case 'pending':
      default:
        return query
          .andWhere('permit.boss_status = :pendingStatus', {
            pendingStatus: ExitPermitStatus.PENDING,
          })
          .andWhere('permit.stage = :bossStage', {
            bossStage: ExitPermitStage.BOSS_REVIEW,
          });
    }
  }

  private mapExitPermitInboxItem(
    permit: EmployeeExitPermit,
    reviewer: 'boss' | 'hr',
  ) {
    const employee = permit.employee;
    const currentRecord = employee?.jobRecords?.find(
      (record) => String(record.status || '').toLowerCase() === 'active',
    );
    const fullName = [
      employee?.firstName,
      employee?.middleName,
      employee?.lastName,
      employee?.secondLastName,
    ]
      .filter(Boolean)
      .join(' ');
    const reviewedAt =
      reviewer === 'boss'
        ? permit.boss_reviewed_at || permit.updated_at || null
        : permit.hr_reviewed_at || permit.updated_at || null;

    return {
      id: permit.id,
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
      departmentName:
        currentRecord?.area?.name || permit.area?.name || 'Sin área asignada',
      status: reviewer === 'boss' ? permit.boss_status : permit.hr_status,
      stage: permit.stage,
      exitDate: permit.exit_date,
      endDate: permit.end_date || permit.exit_date,
      exitTime: permit.exit_time,
      returnTime: permit.return_time,
      withoutReturn: permit.without_return,
      personalDuration: permit.personal_duration,
      hasSupport: Boolean(permit.support_file_path),
      documentsComplete: this.isPersonalPermit(permit.permit_type) || Boolean(permit.support_file_path),
      description: permit.description,
      resolvedAt: reviewedAt,
      typeLabel: permit.permit_type || 'Personal',
      durationMinutes: this.getDurationInMinutes(
        permit.exit_time,
        permit.return_time,
      ),
    };
  }

  private isPersonalPermit(permitType?: string | null) {
    return String(permitType || '').trim().toLocaleLowerCase('es') === 'personal';
  }

  private getDurationInMinutes(exitTime: string, returnTime: string | null) {
    if (!exitTime || !returnTime) {
      return null;
    }

    const [exitHour, exitMinute] = exitTime.split(':').map(Number);
    const [returnHour, returnMinute] = returnTime.split(':').map(Number);

    const exitTotalMinutes = exitHour * 60 + exitMinute;
    let returnTotalMinutes = returnHour * 60 + returnMinute;

    if (returnTotalMinutes < exitTotalMinutes) {
      returnTotalMinutes += 24 * 60;
    }

    return Math.max(returnTotalMinutes - exitTotalMinutes, 0);
  }

  private employeeName(employee: Employee | null | undefined) {
    return [
      employee?.firstName,
      employee?.middleName,
      employee?.lastName,
      employee?.secondLastName,
    ]
      .filter(Boolean)
      .join(' ') || 'Empleado';
  }

  private async notifyEmployeeOfStatus(
    employee: Employee,
    requestType: string,
    status: ExitPermitStatus,
    message: string,
    observation?: string,
    attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [],
  ) {
    await sendRequestNotification(
      employee?.email,
      `${requestType.charAt(0).toUpperCase() + requestType.slice(1)} ${
        status === ExitPermitStatus.APPROVED ? 'aprobado' : 'denegado'
      }`,
      this.employeeName(employee),
      message,
      observation ? [`Observación: ${observation}`] : [],
      'https://sigerh.senasa.gob.hn/exit-permits/history',
      attachments,
    );
    await this.pushNotifications.sendToEmployee(
      employee?.id,
      `Pase de salida ${status === ExitPermitStatus.APPROVED ? 'aprobado' : 'denegado'}`,
      message,
      '/exit-permits/history',
    );
  }

  private pdfStreamToBuffer(pdf: NodeJS.ReadableStream & { end: () => void }) {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      pdf.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);
      pdf.end();
    });
  }
}
