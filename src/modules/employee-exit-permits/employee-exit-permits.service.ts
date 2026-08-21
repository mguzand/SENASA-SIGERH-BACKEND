import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Not, Repository } from 'typeorm';

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
  ) {}

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
    const areaIds = await this.areaManagersService.findAreaIdsByEmployeeAndRole(
      currentEmployeeId,
      AreaManagerRole.BOSS,
    );
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

    this.applyBossOwnershipFilter(query, currentEmployeeId, areaIds);

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

    this.applyBossOwnershipFilter(statsBaseQuery, currentEmployeeId, areaIds);

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
      documentsComplete: permit.permit_type === 'Personal' || Boolean(permit.support_file_path),
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

    const areaIds = await this.areaManagersService.findAreaIdsByEmployeeAndRole(
      currentEmployeeId,
      AreaManagerRole.BOSS,
    );
    const ownsAssignedRequest = permit.boss_employee_id === currentEmployeeId;
    const canTakeOverAreaRequest =
      permit.approval_scope !== 'REGIONAL' && areaIds.includes(permit.area_id);
    if (!ownsAssignedRequest && !canTakeOverAreaRequest) {
      throw new ForbiddenException('No tienes permiso para consultar esta solicitud');
    }

    return this.mapExitPermitInboxItem(permit, 'boss');
  }

  async create(dto: CreateEmployeeExitPermitDto) {
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

    const isPersonal = dto.permit_type === 'Personal';
    const endDate = dto.end_date || dto.exit_date;
    if (endDate < dto.exit_date) {
      throw new BadRequestException('La fecha final no puede ser anterior a la fecha de salida');
    }
    if (isPersonal && endDate !== dto.exit_date) {
      throw new BadRequestException('Los pases personales solo pueden solicitarse para un día');
    }
    const personalDuration = isPersonal
      ? this.classifyPersonalPermit(dto.exit_time, dto.return_time, Boolean(dto.without_return))
      : null;
    if (isPersonal) await this.validatePersonalMonthlyQuota(dto.employee_id, dto.exit_date, personalDuration!);

    const supportMimeType = this.validateSupportImage(dto.base64FileFoto);

    const exitPermit = this.exitPermitRepository.create({
      employee_id: dto.employee_id,
      area_id: dto.area_id,
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
      const extension = supportMimeType === 'image/png' ? 'png' : supportMimeType === 'image/webp' ? 'webp' : 'jpg';
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

    return savedPermit;
  }

  private classifyPersonalPermit(exitTime: string, returnTime?: string, withoutReturn = false): 'HALF' | 'FULL' {
    if (withoutReturn || !returnTime) return 'FULL';
    const exitMinutes = this.timeToMinutes(exitTime);
    const returnMinutes = this.timeToMinutes(returnTime);
    if (returnMinutes <= exitMinutes) throw new BadRequestException('La hora de retorno debe ser mayor a la hora de salida');
    return exitMinutes >= 9 * 60 && returnMinutes <= 12 * 60 && returnMinutes - exitMinutes <= 3 * 60
      ? 'HALF'
      : 'FULL';
  }

  private async validatePersonalMonthlyQuota(employeeId: string, exitDate: string, requested: 'HALF' | 'FULL') {
    const monthStart = `${exitDate.slice(0, 7)}-01`;
    const date = new Date(`${monthStart}T12:00:00`);
    date.setMonth(date.getMonth() + 1);
    const nextMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    const permits = await this.exitPermitRepository.find({
      where: {
        employee_id: employeeId,
        permit_type: 'Personal',
        status: Not(ExitPermitStatus.REJECTED),
      },
    });
    const monthly = permits.filter((permit) => {
      const value = String(permit.exit_date).slice(0, 10);
      return value >= monthStart && value < nextMonth;
    });
    if (requested === 'FULL' && monthly.length) {
      throw new BadRequestException('Ya utilizó parte del cupo personal de este mes. Solo se permite un pase completo o dos medios días.');
    }
    if (requested === 'HALF' && (monthly.some((permit) => permit.personal_duration !== 'HALF') || monthly.filter((permit) => permit.personal_duration === 'HALF').length >= 2)) {
      throw new BadRequestException('Ya alcanzó el límite mensual de pases personales.');
    }
  }

  private validateSupportImage(base64?: string) {
    if (!base64) return null;
    const match = base64.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) throw new BadRequestException('El respaldo debe ser una imagen JPG, PNG o WEBP');
    if (Buffer.byteLength(match[2], 'base64') > 5 * 1024 * 1024) throw new BadRequestException('La imagen de respaldo debe pesar 5 MB o menos');
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
      relations: { employee: true },
    });

    if (!exitPermit) {
      throw new NotFoundException('Solicitud de salida no encontrada');
    }

    if (exitPermit.stage !== ExitPermitStage.BOSS_REVIEW) {
      throw new BadRequestException(
        'Esta solicitud no está en etapa de revisión del jefe',
      );
    }

    if (exitPermit.boss_employee_id) {
      if (exitPermit.boss_employee_id !== currentEmployeeId) {
        const delegatedAreaIds =
          await this.areaManagersService.findAreaIdsByEmployeeAndRole(
            currentEmployeeId,
            AreaManagerRole.BOSS,
          );
        const canTakeOverAreaRequest =
          exitPermit.approval_scope !== 'REGIONAL' &&
          delegatedAreaIds.includes(exitPermit.area_id);

        if (!canTakeOverAreaRequest) {
          throw new ForbiddenException(
            'No tienes permiso para revisar esta solicitud',
          );
        }
      }
    } else {
      const areaIds =
        await this.areaManagersService.findAreaIdsByEmployeeAndRole(
          currentEmployeeId,
          AreaManagerRole.BOSS,
        );

      if (!areaIds.includes(exitPermit.area_id)) {
        throw new ForbiddenException(
          'No tienes permiso para revisar esta solicitud',
        );
      }
    }

    exitPermit.boss_status = dto.status;
    exitPermit.boss_observation = dto.observation ?? null;
    exitPermit.boss_reviewed_at = new Date();

    if (dto.status === ExitPermitStatus.APPROVED) {
      exitPermit.stage = ExitPermitStage.HR_REVIEW;
      exitPermit.status = ExitPermitStatus.PENDING;
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
    const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    permit.support_file_path = this.storageService.saveBase64File(base64FileFoto, `exit-permits/${permit.id}`, `support.${extension}`);
    permit.support_mime_type = mimeType;
    await this.exitPermitRepository.save(permit);
    return { id: permit.id, hasSupport: true, documentsComplete: true };
  }

  private applyBossOwnershipFilter(
    query: any,
    currentEmployeeId: string,
    areaIds: string[],
  ) {
    if (areaIds.length) {
      return query.andWhere(
        `(permit.boss_employee_id = :currentEmployeeId
          OR (
            permit.approval_scope IS DISTINCT FROM 'REGIONAL'
            AND permit.area_id IN (:...legacyAreaIds)
            AND permit.stage = :delegableBossStage
          ))`,
        {
          currentEmployeeId,
          legacyAreaIds: areaIds,
          delegableBossStage: ExitPermitStage.BOSS_REVIEW,
        },
      );
    }

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
      relations: { employee: true },
    });

    if (!exitPermit) {
      throw new NotFoundException('Solicitud de salida no encontrada');
    }

    if (exitPermit.stage !== ExitPermitStage.HR_REVIEW) {
      throw new BadRequestException(
        'Esta solicitud no está en etapa de revisión de RRHH',
      );
    }

    if (dto.status === ExitPermitStatus.APPROVED && exitPermit.permit_type !== 'Personal' && !exitPermit.support_file_path) {
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
    await this.notifyEmployeeOfStatus(
      savedPermit.employee,
      'pase de salida',
      dto.status,
      dto.status === ExitPermitStatus.APPROVED
        ? 'Recursos Humanos aprobó definitivamente su solicitud.'
        : 'Recursos Humanos denegó su solicitud.',
      dto.observation,
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
      documentsComplete: permit.permit_type === 'Personal' || Boolean(permit.support_file_path),
      description: permit.description,
      resolvedAt: reviewedAt,
      typeLabel: permit.permit_type || 'Personal',
      durationMinutes: this.getDurationInMinutes(
        permit.exit_time,
        permit.return_time,
      ),
    };
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
  ) {
    await sendRequestNotification(
      employee?.email,
      `${requestType.charAt(0).toUpperCase() + requestType.slice(1)} ${
        status === ExitPermitStatus.APPROVED ? 'aprobado' : 'denegado'
      }`,
      this.employeeName(employee),
      message,
      observation ? [`Observación: ${observation}`] : [],
    );
  }
}
