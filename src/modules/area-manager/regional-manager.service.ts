import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
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
import { StorageService } from 'src/common/services/storage.service';
import { UpdateRegionalManagerSignatureDto } from './dto/update-regional-manager-signature.dto';

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
    private readonly storageService: StorageService,
  ) {}

  async ensureHrLiaisonPermissionComponent() {
    const systemId = this.configService.get<string>(
      'DEFAULT_SYSTEM_ID',
      '6816a2e5-085a-4d96-8a36-a8546d886051',
    );
    const existing = await this.componentsRepository.findOne({
      where: { system_id: systemId, description: 'Enlace de RRHH' },
    });
    if (existing) return existing;
    const last = await this.componentsRepository.findOne({
      where: { system_id: systemId },
      order: { orden: 'DESC' },
    });
    return this.componentsRepository.save(
      this.componentsRepository.create({
        description: 'Enlace de RRHH',
        system_id: systemId,
        orden: Number(last?.orden || 0) + 1,
        visible: true,
      }),
    );
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
      hasSignature: Boolean(record.signature_path),
      createdAt: record.created_at || null,
    }));
  }

  async getLeaveFinalApprover(allowLegacyFallback = true) {
    let record = await this.regionalManagerRepository.findOne({
      where: {
        is_active: true,
        role: RegionalManagerRole.LEAVE_FINAL_APPROVER,
      },
      relations: { employee: true, regional: true },
      order: { created_at: 'DESC' },
    });
    if (!record && allowLegacyFallback) {
      record = await this.regionalManagerRepository
        .createQueryBuilder('manager')
        .innerJoinAndSelect('manager.employee', 'employee')
        .innerJoinAndSelect('manager.regional', 'regional')
        .where('manager.is_active = true')
        .andWhere('manager.role = :role', {
          role: RegionalManagerRole.REGIONAL_MANAGER,
        })
        .andWhere('regional.is_main_office = true')
        .orderBy('manager.created_at', 'DESC')
        .getOne();
    }
    if (!record)
      throw new BadRequestException(
        'No hay un aprobador final de licencias configurado.',
      );
    return this.mapRecord(record);
  }

  async assignLeaveFinalApprover(employeeId: string) {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
    });
    if (!employee || String(employee.status).toLowerCase() !== 'active')
      throw new BadRequestException(
        'El aprobador final debe ser un empleado activo.',
      );
    const mainOffice = await this.regionalRepository.findOne({
      where: { is_main_office: true, is_active: true },
    });
    if (!mainOffice)
      throw new BadRequestException('No existe una oficina principal activa.');
    await this.regionalManagerRepository.update(
      { role: RegionalManagerRole.LEAVE_FINAL_APPROVER, is_active: true },
      { is_active: false },
    );
    await this.regionalManagerRepository.save(
      this.regionalManagerRepository.create({
        regional_id: mainOffice.id,
        employee_id: employee.id,
        role: RegionalManagerRole.LEAVE_FINAL_APPROVER,
        is_active: true,
      }),
    );
    return this.getLeaveFinalApprover(false);
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
      where: {
        regional_id: regionalId,
        is_active: true,
        role: RegionalManagerRole.REGIONAL_MANAGER,
      },
      relations: { employee: true, regional: true },
      order: { created_at: 'DESC' },
    });
  }

  async getAttendanceReportSignatories(regionalId: string) {
    const [manager, liaisons] = await Promise.all([
      this.regionalManagerRepository.findOne({
        where: {
          regional_id: regionalId,
          is_active: true,
          role: RegionalManagerRole.REGIONAL_MANAGER,
        },
        relations: { employee: true },
        order: { created_at: 'DESC' },
      }),
      this.regionalManagerRepository.find({
        where: {
          regional_id: regionalId,
          is_active: true,
          role: RegionalManagerRole.HR_LIAISON,
        },
        relations: { employee: true },
        order: { created_at: 'DESC' },
      }),
    ]);
    const liaison = liaisons.find((item) => item.signature_path) || liaisons[0] || null;
    return [
      manager ? this.mapAttendanceSignatory(manager, 'JEFE REGIONAL') : null,
      liaison ? this.mapAttendanceSignatory(liaison, 'ENLACE DE RR. HH. REGIONAL') : null,
    ].filter(Boolean) as Array<{
      name: string;
      title: string;
      signaturePath: string | null;
    }>;
  }

  findRegionalIdsByEmployee(employeeId: string) {
    return this.regionalManagerRepository
      .find({
        where: {
          employee_id: employeeId,
          is_active: true,
          role: RegionalManagerRole.REGIONAL_MANAGER,
        },
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
    const { regional, employee } = await this.validateRegionalEmployee(
      dto,
      'El enlace de RR. HH.',
    );
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
    if (existing)
      throw new BadRequestException(
        'Este empleado ya es enlace activo de RR. HH. en la regional.',
      );

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

  async updateSignature(id: string, dto: UpdateRegionalManagerSignatureDto) {
    const record = await this.regionalManagerRepository.findOne({
      where: {
        id,
        is_active: true,
        role: In([
          RegionalManagerRole.REGIONAL_MANAGER,
          RegionalManagerRole.HR_LIAISON,
        ]),
      },
    });
    if (!record)
      throw new NotFoundException('Jefe regional o enlace de RR. HH. no encontrado.');

    const match = dto.signature_base64.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
    if (!match || match[1] !== dto.mime_type)
      throw new BadRequestException('La firma debe ser una imagen PNG, JPG o WebP válida.');
    const signatureBuffer = Buffer.from(match[2], 'base64');
    const size = signatureBuffer.length;
    if (!size || size > 3 * 1024 * 1024)
      throw new BadRequestException('La firma no puede superar los 3 MB.');
    if (!this.isValidSignatureImage(signatureBuffer, dto.mime_type))
      throw new BadRequestException(
        'El contenido del archivo no corresponde a una imagen PNG, JPG o WebP válida.',
      );

    const extension = dto.mime_type === 'image/jpeg' ? 'jpg' : dto.mime_type.split('/')[1];
    const previousPath = record.signature_path;
    record.signature_path = this.storageService.saveBase64File(
      dto.signature_base64,
      'regional-signatures',
      `${record.id}-${randomUUID()}.${extension}`,
    );
    record.signature_mime_type = dto.mime_type;
    record.signature_original_name = dto.original_name.trim();
    await this.regionalManagerRepository.save(record);
    if (previousPath) this.storageService.deleteFile(previousPath);
    return { id: record.id, hasSignature: true };
  }

  private isValidSignatureImage(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        )
      );
    }
    if (mimeType === 'image/jpeg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimeType === 'image/webp') {
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    return false;
  }

  async getSignature(id: string) {
    const record = await this.regionalManagerRepository.findOne({ where: { id } });
    if (!record?.signature_path)
      throw new NotFoundException('Esta asignación no tiene una firma registrada.');
    return {
      absolutePath: this.storageService.getAbsolutePath(record.signature_path),
      mimeType: record.signature_mime_type || 'image/png',
    };
  }

  async deactivateHrLiaison(id: string) {
    const liaison = await this.regionalManagerRepository.findOne({
      where: { id, role: RegionalManagerRole.HR_LIAISON, is_active: true },
    });
    if (!liaison)
      throw new NotFoundException('Enlace de RR. HH. activo no encontrado.');
    liaison.is_active = false;
    await this.regionalManagerRepository.save(liaison);
    return { id, isActive: false };
  }

  async updateHrLiaisonPermissions(
    id: string,
    dto: UpdateHrLiaisonPermissionsDto,
  ) {
    const liaison = await this.regionalManagerRepository.findOne({
      where: { id, role: RegionalManagerRole.HR_LIAISON, is_active: true },
    });
    if (!liaison)
      throw new NotFoundException('Enlace de RR. HH. activo no encontrado.');
    liaison.can_review_vacations = Boolean(dto.can_review_vacations);
    liaison.can_review_exit_permits = Boolean(dto.can_review_exit_permits);
    liaison.can_review_leaves = Boolean(dto.can_review_leaves);
    return this.regionalManagerRepository.save(liaison);
  }

  findActiveHrLiaisonsByPermission(
    regionalId: string,
    permission: 'vacations' | 'exit_permits' | 'leaves',
  ) {
    const column =
      permission === 'vacations'
        ? 'can_review_vacations'
        : permission === 'exit_permits'
          ? 'can_review_exit_permits'
          : 'can_review_leaves';
    return this.regionalManagerRepository
      .createQueryBuilder('liaison')
      .innerJoinAndSelect('liaison.employee', 'employee')
      .innerJoinAndSelect('liaison.regional', 'regional')
      .innerJoin(User, 'appUser', 'appUser.employeeId = liaison.employee_id')
      .innerJoin(RolUser, 'permission', 'permission.user_id = appUser.id')
      .innerJoin('permission.components', 'component')
      .where('liaison.regional_id = :regionalId', { regionalId })
      .andWhere('liaison.role = :role', {
        role: RegionalManagerRole.HR_LIAISON,
      })
      .andWhere('liaison.is_active = true')
      .andWhere(`liaison.${column} = true`)
      .andWhere('component.description = :component', {
        component: 'Enlace de RRHH',
      })
      .getMany();
  }

  findMainOfficeHrLiaisonsByPermission(
    permission: 'vacations' | 'exit_permits' | 'leaves',
  ) {
    const column =
      permission === 'vacations'
        ? 'can_review_vacations'
        : permission === 'exit_permits'
          ? 'can_review_exit_permits'
          : 'can_review_leaves';
    return this.regionalManagerRepository
      .createQueryBuilder('liaison')
      .innerJoinAndSelect('liaison.employee', 'employee')
      .innerJoinAndSelect('liaison.regional', 'regional')
      .innerJoin(User, 'appUser', 'appUser.employeeId = liaison.employee_id')
      .innerJoin(RolUser, 'permission', 'permission.user_id = appUser.id')
      .innerJoin('permission.components', 'component')
      .where('regional.is_main_office = true')
      .andWhere('regional.is_active = true')
      .andWhere('liaison.role = :role', {
        role: RegionalManagerRole.HR_LIAISON,
      })
      .andWhere('liaison.is_active = true')
      .andWhere(`liaison.${column} = true`)
      .andWhere('component.description = :component', {
        component: 'Enlace de RRHH',
      })
      .getMany();
  }

  async getHrLiaisonAccess(employeeId: string) {
    const userRepository =
      this.componentsRepository.manager.getRepository(User);
    const account = await userRepository
      .createQueryBuilder('appUser')
      .where('appUser.employee_id = :identifier', { identifier: employeeId })
      .orWhere('appUser.id = :identifier', { identifier: employeeId })
      .getOne();
    const resolvedEmployeeId = account?.employeeId || employeeId;

    const records = await this.regionalManagerRepository.find({
      where: {
        employee_id: resolvedEmployeeId,
        role: RegionalManagerRole.HR_LIAISON,
        is_active: true,
      },
      relations: { regional: true },
    });

    // Validate the menu permission independently from the liaison assignment.
    // Joining both checks in one query made a valid assignment disappear whenever
    // an old/duplicated component row was the one assigned to the user.
    const hasModulePermission = await this.regionalManagerRepository
      .createQueryBuilder('liaison')
      .innerJoin(User, 'appUser', 'appUser.employee_id = :resolvedEmployeeId', {
        resolvedEmployeeId,
      })
      .innerJoin(RolUser, 'permission', 'permission.user_id = appUser.id')
      .innerJoin(
        Components,
        'component',
        'component.components_id = permission.component_id',
      )
      .where('liaison.employee_id = :resolvedEmployeeId', {
        resolvedEmployeeId,
      })
      .andWhere('liaison.role = :role', {
        role: RegionalManagerRole.HR_LIAISON,
      })
      .andWhere('liaison.is_active = true')
      .andWhere(
        `LOWER(REGEXP_REPLACE(TRIM(component.description), '[^a-zA-Z0-9]+', '', 'g')) = :componentKey`,
        { componentKey: 'enlacederrhh' },
      )
      .getExists();

    return {
      hasAccess: hasModulePermission && records.length > 0,
      hasModulePermission,
      hasActiveAssignment: records.length > 0,
      employeeId: resolvedEmployeeId,
      requestedIdentifier: employeeId,
      assignments: (hasModulePermission ? records : []).map((record) => ({
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

  private async validateRegionalEmployee(
    dto: CreateRegionalManagerDto,
    label: string,
  ) {
    const regional = await this.regionalRepository.findOne({
      where: { id: dto.regional_id, is_active: true },
    });
    if (!regional)
      throw new NotFoundException('Regional no encontrada o inactiva.');
    const employee = await this.employeeRepository.findOne({
      where: { id: dto.employee_id },
    });
    if (!employee || String(employee.status).toLowerCase() !== 'active') {
      throw new BadRequestException(`${label} debe ser un empleado activo.`);
    }
    if (employee.regional_id !== regional.id) {
      throw new BadRequestException(
        'El empleado seleccionado debe pertenecer a la regional asignada.',
      );
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
      employeeName: [
        record.employee?.firstName,
        record.employee?.middleName,
        record.employee?.lastName,
        record.employee?.secondLastName,
      ]
        .filter(Boolean)
        .join(' '),
      employeeEmail: record.employee?.email || null,
      hasSignature: Boolean(record.signature_path),
      role: record.role,
      permissions: {
        vacations: record.can_review_vacations,
        exitPermits: record.can_review_exit_permits,
        leaves: record.can_review_leaves,
      },
      createdAt: record.created_at || null,
    };
  }

  private mapAttendanceSignatory(record: RegionalManager, title: string) {
    return {
      name: [
        record.employee?.firstName,
        record.employee?.middleName,
        record.employee?.lastName,
        record.employee?.secondLastName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleUpperCase('es-HN'),
      title,
      signaturePath: record.signature_path
        ? this.storageService.getAbsolutePath(record.signature_path)
        : null,
    };
  }
}
