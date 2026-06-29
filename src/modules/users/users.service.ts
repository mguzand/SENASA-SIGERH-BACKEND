import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePasswordDto } from 'src/common/auth/dto/change-password.dto';
import { hashPassword } from 'src/common/helpers/password.helper';
import { RolUserService } from '../rol-user/rol-user.service';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { Components } from '../components/entities/components.entity';
import { Rol } from '../rol/entities/rol.entity';
import { ListSystemUsersDto } from './dto/list-system-users.dto';
import { UpdateSystemUserPermissionsDto } from './dto/update-system-user-permissions.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private _userRepo: Repository<User>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeJobRecord)
    private readonly employeeJobRecordRepository: Repository<EmployeeJobRecord>,
    @InjectRepository(RolUser)
    private readonly rolUserRepository: Repository<RolUser>,
    @InjectRepository(Components)
    private readonly componentsRepository: Repository<Components>,
    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,
    private readonly dataSource: DataSource,

    private readonly _rolUserService: RolUserService,
  ) {}

  async findById(id: string) {
    const values = await this._userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.employee', 'employee')
      .leftJoinAndSelect('employee.schedule', 'schedule')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )

      .where('user.id = :id', { id })
      .andWhere('user.is_active = :isActive', { isActive: true })
      .getOne();

      if (values) {
        return this.formatDataSSO(values);
      } else {
        return null;
      } 
  }

  async formatDataSSO(items: any) {
     const { employee, ...rest } = items;
     const currentRecord = employee.jobRecords?.find(
      (record: any) => String(record.status || '').toLowerCase() === 'active',
     );

     return {
      id: rest.id,
      username: rest.username,
      isActive: rest.isActive,
       employee: employee ? {
         id: employee.id,
         rtn: employee.rtn,
         names: employee.firstName + ' ' + employee.middleName,
         surname: employee.lastName + ' ' + employee.secondLastName,
         firstName: employee.firstName,
         middleName: employee.middleName,
         lastName: employee.lastName,
         secondLastName: employee.secondLastName,
         email: employee.email,
         phone: employee.phone,
         modalityName: currentRecord?.modality?.name || null,
            functionalPositionName:
              currentRecord?.functionalPosition?.name || null,
            nominalPositionName: currentRecord?.position?.name || null,
            departmentName: currentRecord?.area?.name || null,
            department_id: currentRecord?.area?.id || null,

       }: null,
     }


  }


  async createUser(
    dto: {
      employeeId: string;
      username?: string;
      email: string;
      password: string;
      firstName?: string | null;
      lastName?: string | null;
      secondLastName?: string | null;
    },
    manager: EntityManager,
  ) {
    const username = await this.resolveAvailableUsername(dto, manager);

    const dataQuery = manager.create(User, {
      employeeId: dto.employeeId,
      username,
      email: dto.email,
      password: hashPassword(dto.password),
    });

    return await manager.save(User, dataQuery);
  }

  private async resolveAvailableUsername(
    dto: {
      username?: string;
      firstName?: string | null;
      lastName?: string | null;
      secondLastName?: string | null;
    },
    manager: EntityManager,
  ) {
    const usernameParts = this.buildUsernameParts(
      dto.firstName ?? null,
      dto.lastName ?? null,
    );

    const preferred =
      this.normalizeUsername(dto.username, true) ||
      this.joinUsernameParts(usernameParts.firstName, usernameParts.lastName) ||
      `user${Date.now()}`;

    const secondLastInitial = this.getInitial(dto.secondLastName);
    const candidates = [preferred];

    if (
      secondLastInitial &&
      usernameParts.firstName &&
      usernameParts.lastName
    ) {
      candidates.push(
        this.joinUsernameParts(
          usernameParts.firstName,
          `${usernameParts.lastName}${secondLastInitial}`,
        ),
      );
    }

    for (const candidate of candidates) {
      if (!(await this.usernameExists(candidate, manager))) {
        return candidate;
      }
    }

    let suffix = 2;
    while (suffix < 1000) {
      const candidate = `${preferred}${suffix}`;
      if (!(await this.usernameExists(candidate, manager))) {
        return candidate;
      }
      suffix += 1;
    }

    throw new BadRequestException([
      'No fue posible generar un nombre de usuario disponible.',
    ]);
  }

  private async usernameExists(username: string, manager: EntityManager) {
    const existing = await manager.findOne(User, {
      where: { username },
      select: { id: true },
    });

    return !!existing;
  }

  private buildUsernameParts(
    firstName: string | null,
    lastName: string | null,
  ) {
    return {
      firstName: this.getFirstToken(firstName),
      lastName: this.getFirstToken(lastName),
    };
  }

  private joinUsernameParts(firstName: string, lastName: string) {
    if (!firstName && !lastName) {
      return '';
    }

    if (!firstName) return lastName;
    if (!lastName) return firstName;

    return `${firstName}.${lastName}`;
  }

  private getInitial(value: string | null | undefined) {
    const normalized = this.normalizeUsername(value);
    return normalized ? normalized.charAt(0) : '';
  }

  private getFirstToken(value: string | null | undefined) {
    const normalized = this.normalizeUsername(value);
    if (!normalized) return '';

    return normalized.split('.').filter(Boolean)[0] || '';
  }

  private normalizeUsername(
    value: string | null | undefined,
    keepDots = false,
  ) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(keepDots ? /[^a-z0-9.]/g : /[^a-z0-9]/g, '')
      .replace(/\.{2,}/g, '.')
      .replace(/^\.+|\.+$/g, '');
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                                 Get the user by user                                 //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async findByUserQuery(
    username: string,
    system: string = '95e272a3-5113-4663-9a04-213f2f8f391a',
  ) {
    const values = await this._userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.employee', 'employee')
      .leftJoinAndSelect('employee.schedule', 'schedule')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )

      .where('user.username = :username or user.email = :email', {
        username,
        email: username,
      })
      .andWhere('user.is_active = :isActive', { isActive: false })
      .getOne();

    if (values) {
      const dataPermissions = await this._rolUserService.getCountPermissions(
        values.id,
        system,
      );
      if (
        dataPermissions > 0 ||
        system === '95e272a3-5113-4663-9a04-213f2f8f391a'
      ) {
        values['hasPermissions'] = true;
      } else {
        values['hasPermissions'] = false;
      }
      return this.formatData(values);
    } else {
      return null;
    }
  }

  async formatData(items: any) {
    const { employee, ...rest } = items;

    const currentRecord = employee.jobRecords?.find(
      (record) => String(record.status || '').toLowerCase() === 'active',
    );

    return {
      ...rest,
      employee: employee
        ? {
            id: employee.id,
            rtn: employee.rtn,
            names: employee.firstName + ' ' + employee.middleName,
            surname: employee.lastName + ' ' + employee.secondLastName,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            secondLastName: employee.secondLastName,
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            biometricId: employee.biometric_id,

            modalityName: currentRecord?.modality?.name || null,
            functionalPositionName:
              currentRecord?.functionalPosition?.name || null,
            nominalPositionName: currentRecord?.position?.name || null,
            departmentName: currentRecord?.area?.name || null,
            department_id: currentRecord?.area?.id || null,

            scheduleStartTime: employee.schedule?.startTime || null,
            scheduleEndTime: employee.schedule?.endTime || null,

            salary:
              currentRecord?.salary !== null &&
              currentRecord?.salary !== undefined
                ? Number(currentRecord.salary)
                : null,
          }
        : null,
    };
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                  Update the date the date when making a user login                   //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async setLastLoginNow(username: string) {
    const user = await this.findByUserQuery(username);
    if (user) {
      user.session_date = new Date();
      return await this._userRepo.save(user);
    }
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                                   Update User Password                               //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async updatePassword(data: ChangePasswordDto) {
    const user = await this._userRepo.findOne({
      where: { username: data.username },
    });

    if (!user) throw new BadRequestException(['Usuario no encontrado.']);

    user.password = await hashPassword(data.password);
    return await this._userRepo.save(user);
  }

  async findSystemUsers(query: ListSystemUsersDto) {
    const page = Number(query.page || 1);
    const limit = Math.min(Number(query.limit || 12), 50);
    const search = query.search?.trim().toLowerCase() || '';

    const rows = await this.rolUserRepository
      .createQueryBuilder('rolUser')
      .innerJoinAndSelect('rolUser.components', 'component')
      .innerJoinAndSelect('rolUser.role', 'role')
      .innerJoinAndSelect('rolUser.user', 'user')
      .innerJoinAndSelect('user.employee', 'employee')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .where('component.system_id = :systemId', {
        systemId: query.systemId,
      })
      .andWhere(
        search
          ? `(
              LOWER(COALESCE(user.username, '')) LIKE :search OR
              LOWER(COALESCE(user.email, '')) LIKE :search OR
              LOWER(COALESCE(employee.firstName, '') || ' ' || COALESCE(employee.middleName, '') || ' ' || COALESCE(employee.lastName, '') || ' ' || COALESCE(employee.secondLastName, '')) LIKE :search OR
              LOWER(COALESCE(employee.dni, '')) LIKE :search
            )`
          : '1=1',
        search ? { search: `%${search}%` } : {},
      )
      .orderBy('employee.firstName', 'ASC')
      .addOrderBy('employee.lastName', 'ASC')
      .getMany();

    const grouped = new Map<string, any>();

    for (const item of rows) {
      const user = item.user;
      const employee = user?.employee;
      if (!user || !employee) continue;

      const currentRecord = employee.jobRecords?.find(
        (record) => String(record.status || '').toLowerCase() === 'active',
      );

      if (!grouped.has(user.id)) {
        grouped.set(user.id, {
          userId: user.id,
          employeeId: employee.id,
          employeeCode: employee.biometric_id
            ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
            : `EMP-${employee.id.slice(0, 4).toUpperCase()}`,
          fullName: [
            employee.firstName,
            employee.middleName,
            employee.lastName,
            employee.secondLastName,
          ]
            .filter(Boolean)
            .join(' '),
          dni: employee.dni,
          username: user.username,
          email: user.email,
          isActive: user.isActive,
          departmentName: currentRecord?.area?.name || null,
          modalityName: currentRecord?.modality?.name || null,
          permissionsCount: 0,
          componentsCount: 0,
          roles: new Set<string>(),
          components: new Set<number>(),
        });
      }

      const bucket = grouped.get(user.id);
      bucket.permissionsCount += 1;
      bucket.roles.add(item.rol);
      bucket.components.add(item.component_id);
    }

    const data = [...grouped.values()].map((item) => ({
      ...item,
      roles: [...item.roles],
      componentsCount: item.components.size,
    }));

    const total = data.length;
    const start = (page - 1) * limit;
    const paginated = data.slice(start, start + limit);

    return {
      data: paginated,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        totalUsers: total,
        activeUsers: data.filter((item) => item.isActive).length,
        inactiveUsers: data.filter((item) => !item.isActive).length,
        admins: data.filter((item) => item.roles.includes('Admin')).length,
      },
    };
  }

  async findAvailableEmployeesForSystem(systemId: string, search?: string) {
    const normalizedSearch = search?.trim().toLowerCase() || '';

    const users = await this._userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.employee', 'employee')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .where(
        normalizedSearch
          ? `(
              LOWER(COALESCE(user.username, '')) LIKE :search OR
              LOWER(COALESCE(user.email, '')) LIKE :search OR
              LOWER(COALESCE(employee.dni, '')) LIKE :search OR
              LOWER(COALESCE(employee.firstName, '') || ' ' || COALESCE(employee.middleName, '') || ' ' || COALESCE(employee.lastName, '') || ' ' || COALESCE(employee.secondLastName, '')) LIKE :search
            )`
          : '1=1',
        normalizedSearch ? { search: `%${normalizedSearch}%` } : {},
      )
      .orderBy('employee.firstName', 'ASC')
      .addOrderBy('employee.lastName', 'ASC')
      .getMany();

    const permissionRows = await this.rolUserRepository
      .createQueryBuilder('rolUser')
      .innerJoin('rolUser.components', 'component')
      .where('component.system_id = :systemId', { systemId })
      .getMany();

    const usersInSystem = new Set(
      permissionRows.map((row) => String((row as any).user_id)),
    );

    return users
      .filter((user) => !usersInSystem.has(String((user as any).id)))
      .map((user) => {
        const employee = user.employee;
        const currentRecord = employee?.jobRecords?.find(
          (record) => String(record.status || '').toLowerCase() === 'active',
        );

        return {
          userId: user.id,
          employeeId: employee?.id || null,
          employeeCode: employee?.biometric_id
            ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
            : employee?.id
              ? `EMP-${employee.id.slice(0, 4).toUpperCase()}`
              : '',
          fullName: employee
            ? [
                employee.firstName,
                employee.middleName,
                employee.lastName,
                employee.secondLastName,
              ]
                .filter(Boolean)
                .join(' ')
            : user.username,
          username: user.username,
          email: user.email,
          dni: employee?.dni || null,
          departmentName: currentRecord?.area?.name || null,
        };
      });
  }

  async getSystemPermissionCatalog(systemId: string) {
    const [components, roles] = await Promise.all([
      this.componentsRepository.find({
        where: {
          system_id: systemId,
        },
        order: {
          orden: 'ASC',
          components_id: 'ASC',
        },
      }),
      this.rolRepository.find({
        order: {
          rol: 'ASC',
        },
      }),
    ]);

    return {
      components: components.map((component) => ({
        components_id: component.components_id,
        description: component.description,
        orden: component.orden,
        visible: component.visible,
      })),
      roles: roles.map((role) => ({
        rol: role.rol,
        description: role.description,
      })),
    };
  }

  async getSystemUserPermissions(systemId: string, userId: string) {
    const user = await this._userRepo.findOne({
      where: { id: userId },
      relations: {
        employee: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const catalog = await this.getSystemPermissionCatalog(systemId);
    const currentPermissions = await this.rolUserRepository
      .createQueryBuilder('rolUser')
      .innerJoinAndSelect('rolUser.components', 'component')
      .where('rolUser.user_id = :userId', { userId })
      .andWhere('component.system_id = :systemId', { systemId })
      .getMany();

    const selectedByComponent = new Map<number, string>();
    currentPermissions.forEach((item) => {
      selectedByComponent.set(item.component_id, item.rol);
    });

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        employeeId: user.employee?.id || null,
        fullName: user.employee
          ? [
              user.employee.firstName,
              user.employee.middleName,
              user.employee.lastName,
              user.employee.secondLastName,
            ]
              .filter(Boolean)
              .join(' ')
          : user.username,
      },
      components: catalog.components.map((component) => ({
        ...component,
        selectedRole: selectedByComponent.get(component.components_id) || null,
      })),
      roles: catalog.roles,
    };
  }

  async updateSystemUserPermissions(
    systemId: string,
    userId: string,
    dto: UpdateSystemUserPermissionsDto,
  ) {
    const user = await this._userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    const systemComponents = await this.componentsRepository.find({
      where: {
        system_id: systemId,
      },
    });

    const systemComponentIds = systemComponents.map(
      (component) => component.components_id,
    );
    const allowedRoles = await this.rolRepository.find();
    const allowedRoleIds = new Set(allowedRoles.map((role) => role.rol));

    for (const assignment of dto.assignments || []) {
      if (!systemComponentIds.includes(assignment.component_id)) {
        throw new BadRequestException([
          `El componente ${assignment.component_id} no pertenece al sistema seleccionado.`,
        ]);
      }

      if (!allowedRoleIds.has(assignment.rol)) {
        throw new BadRequestException([
          `El rol ${assignment.rol} no es válido.`,
        ]);
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (systemComponentIds.length) {
        await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(RolUser)
          .where('user_id = :userId', { userId })
          .andWhere('component_id IN (:...componentIds)', {
            componentIds: systemComponentIds,
          })
          .execute();
      }

      for (const assignment of dto.assignments || []) {
        const entity = queryRunner.manager.create(RolUser, {
          user_id: userId as any,
          rol: assignment.rol,
          component_id: assignment.component_id,
        });
        await queryRunner.manager.save(RolUser, entity);
      }

      await queryRunner.commitTransaction();

      return this.getSystemUserPermissions(systemId, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
