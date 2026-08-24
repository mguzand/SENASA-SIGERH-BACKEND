import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { Regional } from '../regional/entities/regional.entity';
import { CreateRegionalManagerDto } from './dto/create-regional-manager.dto';
import { RegionalManager } from './entities/regional-manager.entity';
import { RegionalManagerRole } from './interfaces/regional-manager-role.enum';
import { UpdateHrLiaisonPermissionsDto } from './dto/update-hr-liaison-permissions.dto';
import { Components } from '../components/entities/components.entity';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { RolUser } from '../rol-user/entities/rol-user.entity';

@Injectable()
export class RegionalManagerService {
  constructor(
    @InjectRepository(RegionalManager)
    private readonly regionalManagerRepository: Repository<RegionalManager>,
    @InjectRepository(Regional)
    private readonly regionalRepository: Repository<Regional>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Components)
    private readonly componentsRepository: Repository<Components>,
    private readonly configService: ConfigService,
  ) {}

  async ensureHrLiaisonPermissionComponent() {
    const systemId = this.configService.get<string>('DEFAULT_SYSTEM_ID', '6816a2e5-085a-4d96-8a36-a8546d886051');
    const existing = await this.componentsRepository.findOne({ where: { system_id: systemId, description: 'Enlace de RRHH' } });
    if (existing) return existing;
    const last = await this.componentsRepository.findOne({ where: { system_id: systemId }, order: { orden: 'DESC' } });
    return this.componentsRepository.save(this.componentsRepository.create({
      description: 'Enlace de RRHH', system_id: systemId, orden: Number(last?.orden || 0) + 1, visible: true,
    }));
  }

  async findAll() {
    const records = await this.regionalManagerRepository.find({
      where: { is_active: true, role: RegionalManagerRole.REGIONAL_MANAGER },
      relations: { employee: true, regional: true },
      order: { created_at: 'DESC' },
    });

    return records.map((record) => ({
      id: record.id,
      regionalId: record.regional_id,
      regionalName: record.regional?.name || 'Regional sin nombre',
      isMainOffice: record.regional?.is_main_office || false,
      employeeId: record.employee_id,
      employeeName: [
        record.employee?.firstName,
        record.employee?.middleName,
        record.employee?.lastName,
        record.employee?.secondLastName,
      ]
        .filter(Boolean)
        .join(' '),
      employeeEmail: record.employee?.email || null,
      createdAt: record.created_at || null,
    }));
  }

  async create(dto: CreateRegionalManagerDto) {
    const regional = await this.regionalRepository.findOne({
      where: { id: dto.regional_id, is_active: true },
    });
    if (!regional) {
      throw new NotFoundException('Regional no encontrada o inactiva.');
    }

    const employee = await this.employeeRepository.findOne({
      where: { id: dto.employee_id },
    });
    if (!employee || String(employee.status).toLowerCase() !== 'active') {
      throw new BadRequestException(
        'El jefe regional debe ser un empleado activo.',
      );
    }

    if (employee.regional_id !== regional.id) {
      throw new BadRequestException(
        'El empleado seleccionado debe pertenecer a la regional asignada.',
      );
    }

    await this.regionalManagerRepository.update(
      {
        regional_id: regional.id,
        is_active: true,
        role: RegionalManagerRole.REGIONAL_MANAGER,
      },
      { is_active: false },
    );

    const manager = await this.regionalManagerRepository.save(
      this.regionalManagerRepository.create({
        regional_id: regional.id,
        employee_id: employee.id,
        is_active: true,
        role: RegionalManagerRole.REGIONAL_MANAGER,
      }),
    );

    return this.regionalManagerRepository.findOne({
      where: { id: manager.id },
      relations: { employee: true, regional: true },
    });
  }

  findActiveByRegional(regionalId: string) {
    return this.regionalManagerRepository.findOne({
      where: { regional_id: regionalId, is_active: true, role: RegionalManagerRole.REGIONAL_MANAGER },
      relations: { employee: true, regional: true },
      order: { created_at: 'DESC' },
    });
  }

  findRegionalIdsByEmployee(employeeId: string) {
    return this.regionalManagerRepository
      .find({
        where: { employee_id: employeeId, is_active: true, role: RegionalManagerRole.REGIONAL_MANAGER },
        select: ['regional_id'],
      })
      .then((records) => records.map((record) => record.regional_id));
  }

  async findHrLiaisons() {
    const records = await this.regionalManagerRepository.find({
      where: { is_active: true, role: RegionalManagerRole.HR_LIAISON },
      relations: { employee: true, regional: true },
      order: { created_at: 'DESC' },
    });
    return records.map((record) => this.mapRecord(record));
  }

  async createHrLiaison(dto: CreateRegionalManagerDto) {
    const { regional, employee } = await this.validateRegionalEmployee(dto, 'El enlace de RR. HH.');
    const existing = await this.regionalManagerRepository.findOne({
      where: {
        regional_id: regional.id,
        employee_id: employee.id,
        role: RegionalManagerRole.HR_LIAISON,
        is_active: true,
        can_review_vacations: Boolean(dto.can_review_vacations),
        can_review_exit_permits: Boolean(dto.can_review_exit_permits),
        can_review_leaves: Boolean(dto.can_review_leaves),
      },
    });
    if (existing) throw new BadRequestException('Este empleado ya es enlace activo de RR. HH. en la regional.');

    const liaison = await this.regionalManagerRepository.save(
      this.regionalManagerRepository.create({
        regional_id: regional.id,
        employee_id: employee.id,
        role: RegionalManagerRole.HR_LIAISON,
        is_active: true,
      }),
    );
    return this.regionalManagerRepository.findOne({
      where: { id: liaison.id },
      relations: { employee: true, regional: true },
    });
  }

  async deactivateHrLiaison(id: string) {
    const liaison = await this.regionalManagerRepository.findOne({
      where: { id, role: RegionalManagerRole.HR_LIAISON, is_active: true },
    });
    if (!liaison) throw new NotFoundException('Enlace de RR. HH. activo no encontrado.');
    liaison.is_active = false;
    await this.regionalManagerRepository.save(liaison);
    return { id, isActive: false };
  }

  async updateHrLiaisonPermissions(id: string, dto: UpdateHrLiaisonPermissionsDto) {
    const liaison = await this.regionalManagerRepository.findOne({
      where: { id, role: RegionalManagerRole.HR_LIAISON, is_active: true },
    });
    if (!liaison) throw new NotFoundException('Enlace de RR. HH. activo no encontrado.');
    liaison.can_review_vacations = Boolean(dto.can_review_vacations);
    liaison.can_review_exit_permits = Boolean(dto.can_review_exit_permits);
    liaison.can_review_leaves = Boolean(dto.can_review_leaves);
    return this.regionalManagerRepository.save(liaison);
  }

  findActiveHrLiaisonsByPermission(
    regionalId: string,
    permission: 'vacations' | 'exit_permits' | 'leaves',
  ) {
    const column = permission === 'vacations'
      ? 'can_review_vacations'
      : permission === 'exit_permits'
        ? 'can_review_exit_permits'
        : 'can_review_leaves';
    return this.regionalManagerRepository.createQueryBuilder('liaison')
      .innerJoinAndSelect('liaison.employee', 'employee')
      .innerJoinAndSelect('liaison.regional', 'regional')
      .innerJoin(User, 'appUser', 'appUser.employeeId = liaison.employee_id')
      .innerJoin(RolUser, 'permission', 'permission.user_id = appUser.id')
      .innerJoin('permission.components', 'component')
      .where('liaison.regional_id = :regionalId', { regionalId })
      .andWhere('liaison.role = :role', { role: RegionalManagerRole.HR_LIAISON })
      .andWhere('liaison.is_active = true')
      .andWhere(`liaison.${column} = true`)
      .andWhere('component.description = :component', { component: 'Enlace de RRHH' })
      .getMany();
  }

  async getHrLiaisonAccess(employeeId: string) {
    const hasModulePermission = await this.regionalManagerRepository.createQueryBuilder('liaison')
      .innerJoin(User, 'appUser', 'appUser.employeeId = liaison.employee_id')
      .innerJoin(RolUser, 'permission', 'permission.user_id = appUser.id')
      .innerJoin('permission.components', 'component')
      .where('liaison.employee_id = :employeeId', { employeeId })
      .andWhere('liaison.role = :role', { role: RegionalManagerRole.HR_LIAISON })
      .andWhere('liaison.is_active = true')
      .andWhere('component.description = :component', { component: 'Enlace de RRHH' })
      .getExists();
    const records = hasModulePermission
      ? await this.regionalManagerRepository.find({
          where: { employee_id: employeeId, role: RegionalManagerRole.HR_LIAISON, is_active: true },
          relations: { regional: true },
        })
      : [];
    return {
      hasAccess: records.length > 0,
      employeeId,
      assignments: records.map((record) => ({
        id: record.id,
        regionalId: record.regional_id,
        regionalName: record.regional?.name || 'Regional',
        isMainOffice: Boolean(record.regional?.is_main_office),
        permissions: {
          vacations: Boolean(record.can_review_vacations),
          exitPermits: Boolean(record.can_review_exit_permits),
          leaves: Boolean(record.can_review_leaves),
        },
        canReviewVacations: Boolean(record.can_review_vacations),
        canReviewExitPermits: Boolean(record.can_review_exit_permits),
        canReviewLeaves: Boolean(record.can_review_leaves),
      })),
    };
  }

  private async validateRegionalEmployee(dto: CreateRegionalManagerDto, label: string) {
    const regional = await this.regionalRepository.findOne({ where: { id: dto.regional_id, is_active: true } });
    if (!regional) throw new NotFoundException('Regional no encontrada o inactiva.');
    const employee = await this.employeeRepository.findOne({ where: { id: dto.employee_id } });
    if (!employee || String(employee.status).toLowerCase() !== 'active') {
      throw new BadRequestException(`${label} debe ser un empleado activo.`);
    }
    if (employee.regional_id !== regional.id) {
      throw new BadRequestException('El empleado seleccionado debe pertenecer a la regional asignada.');
    }
    return { regional, employee };
  }

  private mapRecord(record: RegionalManager) {
    return {
      id: record.id,
      regionalId: record.regional_id,
      regionalName: record.regional?.name || 'Regional sin nombre',
      isMainOffice: record.regional?.is_main_office || false,
      employeeId: record.employee_id,
      employeeName: [record.employee?.firstName, record.employee?.middleName, record.employee?.lastName, record.employee?.secondLastName].filter(Boolean).join(' '),
      employeeEmail: record.employee?.email || null,
      role: record.role,
      permissions: {
        vacations: record.can_review_vacations,
        exitPermits: record.can_review_exit_permits,
        leaves: record.can_review_leaves,
      },
      createdAt: record.created_at || null,
    };
  }
}
