import { BadRequestException, Injectable } from '@nestjs/common';
import { AreaManagerRole } from './interfaces/area-manager-role.enum';
import { AreaManager } from './entities/area-manager.entity';
import { Brackets, LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { StorageService } from 'src/common/services/storage.service';
import { randomUUID } from 'crypto';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { ListAreaManagersDto } from './dto/list-area-managers.dto';
import {
  parseDateOnly,
  serializeDateOnly,
} from 'src/common/utils/date-only.util';
import { RegionalManager } from './entities/regional-manager.entity';
import { RegionalManagerRole } from './interfaces/regional-manager-role.enum';

@Injectable()
export class AreaManagerService {
  constructor(
    @InjectRepository(AreaManager)
    private readonly areaManagerRepository: Repository<AreaManager>,
    @InjectRepository(RegionalManager)
    private readonly regionalManagerRepository: Repository<RegionalManager>,
    private readonly storageService: StorageService,
  ) {}

  async findAll(params: ListAreaManagersDto) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 50);
    const type = params.type || 'all';

    const query = this.areaManagerRepository
      .createQueryBuilder('manager')
      .leftJoinAndSelect('manager.employee', 'employee')
      .leftJoinAndSelect('manager.area', 'area')
      .where('manager.role = :role', {
        role: AreaManagerRole.BOSS,
      })
      .andWhere('manager.is_active = :isActive', {
        isActive: true,
      });

    if (params.areaId?.trim()) {
      query.andWhere('manager.area_id = :areaId', {
        areaId: params.areaId.trim(),
      });
    }

    if (type === 'boss') {
      query.andWhere('manager.is_a_delegate = :isDelegate', {
        isDelegate: false,
      });
    }

    if (type === 'delegate') {
      query.andWhere('manager.is_a_delegate = :isDelegate', {
        isDelegate: true,
      });
    }

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(employee.firstName) LIKE :search', { search });
          qb.orWhere("LOWER(COALESCE(employee.middleName, '')) LIKE :search", {
            search,
          });
          qb.orWhere('LOWER(employee.lastName) LIKE :search', { search });
          qb.orWhere(
            "LOWER(COALESCE(employee.secondLastName, '')) LIKE :search",
            {
              search,
            },
          );
          qb.orWhere(
            "LOWER(COALESCE(employee.biometric_id, '')) LIKE :search",
            { search },
          );
          qb.orWhere("LOWER(COALESCE(area.name, '')) LIKE :search", {
            search,
          });
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

    query.orderBy('area.name', 'ASC').addOrderBy('manager.created_at', 'DESC');

    const [records, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsBaseQuery = this.areaManagerRepository
      .createQueryBuilder('manager')
      .where('manager.role = :role', { role: AreaManagerRole.BOSS })
      .andWhere('manager.is_active = :isActive', { isActive: true });

    const [bossesActive, delegatesActive, areasRaw] = await Promise.all([
      statsBaseQuery
        .clone()
        .andWhere('manager.is_a_delegate = :isDelegate', { isDelegate: false })
        .getCount(),
      statsBaseQuery
        .clone()
        .andWhere('manager.is_a_delegate = :isDelegate', { isDelegate: true })
        .getCount(),
      statsBaseQuery
        .clone()
        .select('COUNT(DISTINCT manager.area_id)', 'total')
        .getRawOne(),
    ]);

    return {
      data: records.map((record) => {
        const employee = record.employee;
        const fullName = [
          employee?.firstName,
          employee?.middleName,
          employee?.lastName,
          employee?.secondLastName,
        ]
          .filter(Boolean)
          .join(' ');

        return {
          id: record.id,
          employeeId: employee?.id || null,
          employeeCode: employee?.biometric_id
            ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
            : employee?.id
              ? `EMP-${employee.id.slice(0, 4).toUpperCase()}`
              : 'EMP-0000',
          employeeName: fullName || 'Empleado sin nombre',
          employeeInitials: `${employee?.firstName?.[0] || ''}${
            employee?.lastName?.[0] || ''
          }`
            .toUpperCase()
            .trim(),
          employeeEmail: employee?.email || null,
          areaId: record.area_id,
          areaName: record.area?.name || 'Sin área',
          isDelegate: record.is_a_delegate,
          documentUrl: record.url_document,
          createdAt: record.created_at,
          delegationEndDate: serializeDateOnly(record.delegation_end_date),
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalRecords: bossesActive + delegatesActive,
        bossesActive,
        delegatesActive,
        areasWithManager: Number(areasRaw?.total || 0),
      },
    };
  }

  async create(dto: CreateAreaManagerDto) {
    if (dto.is_a_delegate && !dto.support_document_base64) {
      throw new BadRequestException(
        'Debe adjuntar un documento de respaldo para registrar un delegado',
      );
    }

    if (dto.is_a_delegate && !dto.delegation_end_date) {
      throw new BadRequestException(
        'Debe indicar hasta cuándo finaliza la delegación',
      );
    }

    const delegationEndDate = dto.is_a_delegate
      ? parseDateOnly(dto.delegation_end_date) || null
      : null;

    if (dto.is_a_delegate && !delegationEndDate) {
      throw new BadRequestException(
        'La fecha de finalización de la delegación no es válida',
      );
    }

    if (
      delegationEndDate &&
      delegationEndDate.getTime() <
        (parseDateOnly(new Date()) || new Date()).getTime()
    ) {
      throw new BadRequestException(
        'La fecha de finalización de la delegación no puede ser anterior a hoy',
      );
    }

    let filePath: string | null = null;

    try {
      if (dto.is_a_delegate && dto.support_document_base64) {
        const extension = (dto.extension || 'pdf')
          .replace('.', '')
          .toLowerCase();
        const fileName = `${randomUUID()}.${extension}`;
        filePath = this.storageService.saveBase64File(
          dto.support_document_base64,
          `area-managers/${dto.area_id}`,
          fileName,
        );
      }

      const activeRecords = await this.areaManagerRepository.find({
        where: {
          area_id: dto.area_id,
          role: AreaManagerRole.BOSS,
          is_active: true,
        },
        order: {
          created_at: 'DESC',
        },
      });

      const activeBoss = activeRecords.find((item) => !item.is_a_delegate) || null;
      const activeDelegate =
        activeRecords.find((item) => item.is_a_delegate) || null;

      let suspendedBossId: string | null = null;

      if (dto.is_a_delegate) {
        suspendedBossId =
          activeBoss?.id || activeDelegate?.suspended_boss_id || null;
      }

      if (activeRecords.length) {
        await this.areaManagerRepository.update(
          {
            area_id: dto.area_id,
            role: AreaManagerRole.BOSS,
            is_active: true,
          },
          {
            is_active: false,
          },
        );
      }

      const manager = this.areaManagerRepository.create({
        area_id: dto.area_id,
        employee_id: dto.employee_id,
        role: AreaManagerRole.BOSS,
        is_a_delegate: dto.is_a_delegate,
        is_active: true,
        url_document: filePath,
        delegation_end_date: delegationEndDate,
        suspended_boss_id: dto.is_a_delegate ? suspendedBossId : null,
      });

      const saved = await this.areaManagerRepository.save(manager);

      return this.areaManagerRepository.findOne({
        where: { id: saved.id },
        relations: ['employee', 'area'],
      });
    } catch (error) {
      if (filePath) {
        this.storageService.deleteFile(filePath);
      }

      throw error;
    }
  }

  async processExpiredDelegations() {
    const today = parseDateOnly(new Date()) || new Date();

    const expiredDelegates = await this.areaManagerRepository.find({
      where: {
        role: AreaManagerRole.BOSS,
        is_active: true,
        is_a_delegate: true,
        delegation_end_date: LessThanOrEqual(today),
      },
      order: {
        delegation_end_date: 'ASC',
        created_at: 'ASC',
      },
    });

    for (const delegate of expiredDelegates) {
      delegate.is_active = false;
      await this.areaManagerRepository.save(delegate);

      const suspendedBoss = delegate.suspended_boss_id
        ? await this.areaManagerRepository.findOne({
            where: {
              id: delegate.suspended_boss_id,
              area_id: delegate.area_id,
              is_a_delegate: false,
              role: AreaManagerRole.BOSS,
            },
          })
        : null;

      const bossToRestore =
        suspendedBoss ||
        (await this.areaManagerRepository.findOne({
          where: {
            area_id: delegate.area_id,
            role: AreaManagerRole.BOSS,
            is_a_delegate: false,
          },
          order: {
            updated_at: 'DESC',
            created_at: 'DESC',
          },
        }));

      if (bossToRestore) {
        bossToRestore.is_active = true;
        await this.areaManagerRepository.save(bossToRestore);
      }
    }

    return expiredDelegates.length;
  }

  async checkEmployeeAccess(areaId: string, employeeId: string) {
    const [manager, leaveFinalApprover] = await Promise.all([
      this.areaManagerRepository.findOne({
        where: {
          area_id: areaId,
          employee_id: employeeId,
          role: AreaManagerRole.BOSS,
          is_active: true,
        },
        relations: ['area'],
      }),
      this.regionalManagerRepository.findOne({
        where: {
          employee_id: employeeId,
          is_active: true,
          role: RegionalManagerRole.LEAVE_FINAL_APPROVER,
        },
        relations: { regional: true },
      }),
    ]);

    if (!manager) {
      const regionalManager = await this.regionalManagerRepository.findOne({
        where: {
          employee_id: employeeId,
          is_active: true,
          role: RegionalManagerRole.REGIONAL_MANAGER,
        },
        relations: { regional: true },
      });

      if (regionalManager) {
        return {
          hasAccess: true,
          hasAreaManagementAccess: true,
          isDelegate: false,
          isRegionalManager: true,
          isLeaveFinalApprover: Boolean(leaveFinalApprover),
          roleLabel: regionalManager.regional?.is_main_office
            ? 'Director General'
            : 'Jefe regional',
          areaId,
          areaName: regionalManager.regional?.name || null,
        };
      }

      if (leaveFinalApprover) {
        return {
          hasAccess: true,
          hasAreaManagementAccess: false,
          isDelegate: false,
          isRegionalManager: false,
          isLeaveFinalApprover: true,
          roleLabel: 'Aprobador de licencias',
          areaId,
          areaName: leaveFinalApprover.regional?.name || null,
        };
      }

      return {
        hasAccess: false,
        hasAreaManagementAccess: false,
        isDelegate: false,
        isRegionalManager: false,
        isLeaveFinalApprover: false,
        roleLabel: null,
        areaId,
        areaName: null,
      };
    }

    return {
      hasAccess: true,
      hasAreaManagementAccess: true,
      isDelegate: manager.is_a_delegate,
      isRegionalManager: false,
      isLeaveFinalApprover: Boolean(leaveFinalApprover),
      roleLabel: manager.is_a_delegate ? 'Delegado' : 'Jefe',
      areaId: manager.area_id,
      areaName: manager.area?.name || null,
    };
  }

  async findActiveManagerByAreaAndRole(
    areaId: string,
    role: AreaManagerRole,
  ): Promise<AreaManager | null> {
    return this.areaManagerRepository.findOne({
      where: {
        area_id: areaId,
        role,
        is_active: true,
      },
    });
  }

  async findTypeEmployee(areaId: string, role: AreaManagerRole) {
    return this.areaManagerRepository
      .createQueryBuilder('area_manager')
      .innerJoinAndSelect('area_manager.employee', 'employee')
      .where(
        'area_manager.area_id = :area_id AND is_active = :is_active AND role = :role',
        {
          area_id: areaId,
          is_active: true,
          role,
        },
      )
      .getOne();
  }

  async findAreaIdsByEmployeeAndRole(
    employeeId: string,
    role: AreaManagerRole,
  ): Promise<string[]> {
    const results = await this.areaManagerRepository.find({
      where: {
        employee_id: employeeId,
        role,
        is_active: true,
      },
      select: ['area_id'],
    });

    return results.map((item) => item.area_id);
  }
}
