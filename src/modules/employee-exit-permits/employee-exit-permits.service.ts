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

import { ExitPermitStage } from './enums/exit-permit-stage.enum';
import { ExitPermitStatus } from './enums/exit-permit-status.enum';
import { AreaManagerRole } from '../area-manager/interfaces/area-manager-role.enum';
import { AreaManagerService } from '../area-manager/area-manager.service';

@Injectable()
export class EmployeeExitPermitsService {
  constructor(
    @InjectRepository(EmployeeExitPermit)
    private readonly exitPermitRepository: Repository<EmployeeExitPermit>,

    private readonly areaManagersService: AreaManagerService,
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
      .where('permit.hr_employee_id = :currentEmployeeId', {
        currentEmployeeId,
      })
      .andWhere('permit.boss_status = :bossApproved', {
        bossApproved: ExitPermitStatus.APPROVED,
      });

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(permit.description) LIKE :search', { search });
          qb.orWhere('LOWER(employee.firstName) LIKE :search', { search });
          qb.orWhere('LOWER(COALESCE(employee.middleName, \'\')) LIKE :search', {
            search,
          });
          qb.orWhere('LOWER(employee.lastName) LIKE :search', { search });
          qb.orWhere(
            'LOWER(COALESCE(employee.secondLastName, \'\')) LIKE :search',
            { search },
          );
          qb.orWhere('LOWER(COALESCE(employee.dni, \'\')) LIKE :search', {
            search,
          });
          qb.orWhere(
            'LOWER(COALESCE(employee.biometric_id, \'\')) LIKE :search',
            { search },
          );
          qb.orWhere('LOWER(COALESCE(area.name, \'\')) LIKE :search', { search });
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
      .where('permit.hr_employee_id = :currentEmployeeId', {
        currentEmployeeId,
      })
      .andWhere('permit.boss_status = :bossApproved', {
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
          employeeInitials: `${employee?.firstName?.[0] || ''}${employee?.lastName?.[0] || ''}`
            .toUpperCase()
            .trim(),
          departmentName:
            currentRecord?.area?.name || permit.area?.name || 'Sin área asignada',
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

  async create(dto: CreateEmployeeExitPermitDto) {
    const bossManager =
      await this.areaManagersService.findActiveManagerByAreaAndRole(
        dto.area_id,
        AreaManagerRole.BOSS,
      );

    if (!bossManager) {
      throw new BadRequestException(
        'No existe un jefe activo configurado para esta área',
      );
    }

    const hrManager =
      await this.areaManagersService.findActiveManagerByAreaAndRole(
        dto.area_id,
        AreaManagerRole.HR,
      );

    if (!hrManager) {
      throw new BadRequestException(
        'No existe un encargado de RRHH activo configurado para esta área',
      );
    }

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

    const exitPermit = this.exitPermitRepository.create({
      employee_id: dto.employee_id,
      area_id: dto.area_id,
      description: dto.description,
      permit_type: dto.permit_type,
      exit_date: dto.exit_date as any,
      exit_time: dto.exit_time,
      return_time: dto.without_return ? null : dto.return_time,
      without_return: dto.without_return ?? false,

      stage: ExitPermitStage.BOSS_REVIEW,
      status: ExitPermitStatus.PENDING,

      boss_employee_id: bossManager.employee_id,
      boss_status: ExitPermitStatus.PENDING,

      hr_employee_id: hrManager.employee_id,
      hr_status: ExitPermitStatus.PENDING,
    });

    return await this.exitPermitRepository.save(exitPermit);
  }

  async reviewByBoss(
    id: string,
    dto: ReviewEmployeeExitPermitDto,
    currentEmployeeId: string,
  ) {
    const exitPermit = await this.exitPermitRepository.findOne({
      where: { id },
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
    }

    if (dto.status === ExitPermitStatus.REJECTED) {
      exitPermit.stage = ExitPermitStage.COMPLETED;
      exitPermit.status = ExitPermitStatus.REJECTED;
    }

    return await this.exitPermitRepository.save(exitPermit);
  }

  async reviewByHr(
    id: string,
    dto: ReviewEmployeeExitPermitDto,
    currentEmployeeId: string,
  ) {
    const exitPermit = await this.exitPermitRepository.findOne({
      where: { id },
    });

    if (!exitPermit) {
      throw new NotFoundException('Solicitud de salida no encontrada');
    }

    if (exitPermit.stage !== ExitPermitStage.HR_REVIEW) {
      throw new BadRequestException(
        'Esta solicitud no está en etapa de revisión de RRHH',
      );
    }

    if (exitPermit.hr_employee_id !== currentEmployeeId) {
      throw new ForbiddenException(
        'No tienes permiso para revisar esta solicitud de RRHH',
      );
    }

    exitPermit.hr_status = dto.status;
    exitPermit.hr_observation = dto.observation ?? null;
    exitPermit.hr_reviewed_at = new Date();

    exitPermit.stage = ExitPermitStage.COMPLETED;

    if (dto.status === ExitPermitStatus.APPROVED) {
      exitPermit.status = ExitPermitStatus.APPROVED;
    }

    if (dto.status === ExitPermitStatus.REJECTED) {
      exitPermit.status = ExitPermitStatus.REJECTED;
    }

    return await this.exitPermitRepository.save(exitPermit);
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
}
