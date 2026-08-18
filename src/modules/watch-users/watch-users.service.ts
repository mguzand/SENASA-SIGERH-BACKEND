import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ListWatchUsersDto } from './dto/list-watch-users.dto';
import { WatchUser } from './entities/watch-user.entity';
import { Employee } from '../employees/entities/employee.entity';

@Injectable()
export class WatchUsersService {
  private readonly logger = new Logger(WatchUsersService.name);

  constructor(
    @InjectRepository(WatchUser, 'sqlserver')
    private readonly repository: Repository<WatchUser>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
  ) {}

  async migrateActiveEmployees() {
    const employees = await this.employeesRepository.find({
      where: { status: 'ACTIVE' },
      relations: { position: true, jobRecords: { functionalPosition: true, position: true } },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    let created = 0;
    let skipped = 0;
    const failed: Array<{ employeeId: string; biometricId: string | null; reason: string }> = [];

    for (const employee of employees) {
      if (!employee.biometric_id) {
        failed.push({ employeeId: employee.id, biometricId: null, reason: 'Empleado sin ID biométrico.' });
        continue;
      }
      try {
        const result = await this.createFromEmployee(employee, false);
        result.created ? created++ : skipped++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Error desconocido.';
        failed.push({ employeeId: employee.id, biometricId: employee.biometric_id, reason });
        this.logger.error(`No se pudo migrar el empleado ${employee.id} al reloj: ${reason}`);
      }
    }
    return { total: employees.length, created, skipped, failed: failed.length, errors: failed };
  }

  async createFromEmployee(employee: Employee, failIfExists = false) {
    if (!employee.biometric_id) throw new Error('El empleado no tiene ID biométrico.');
    const biometricId = String(employee.biometric_id).trim();
    if (!biometricId) throw new Error('El empleado no tiene un ID biométrico válido.');
    const existing = await this.repository
      .createQueryBuilder('watchUser')
      .where('LTRIM(RTRIM(watchUser.userId)) = :biometricId', { biometricId })
      .getOne();
    if (existing) {
      if (failIfExists) throw new Error(`El usuario ${biometricId} ya existe en el reloj.`);
      return { created: false, userId: biometricId };
    }
    const activeJob = employee.jobRecords?.find((record) => record.isCurrent || String(record.status).toUpperCase() === 'ACTIVE');
    const user = this.repository.create({
      userId: biometricId,
      userCode: biometricId,
      name: this.limit([employee.firstName, employee.middleName, employee.lastName, employee.secondLastName].filter(Boolean).join(' ').toUpperCase(), 50),
      sex: this.normalizeSex(employee.gender),
      password: employee.birth_date ? String(new Date(employee.birth_date).getUTCFullYear()) : null,
      departmentId: 1,
      nation: null,
      birthday: employee.birth_date ? new Date(employee.birth_date) : null,
      employmentDate: employee.entryDate ? new Date(employee.entryDate) : null,
      telephone: this.limit(employee.phone, 50),
      duty: this.limit(activeJob?.functionalPosition?.name || activeJob?.position?.name || employee.position?.name, 50),
      nativePlace: this.limit(employee.birth_place, 50),
      idCard: this.limit(employee.dni, 50),
      address: this.limit(employee.address, 150),
      mobile: this.limit(employee.phone, 50),
      education: null,
      polity: null,
      specialty: null,
      isAttendanceEnabled: false,
      isOvertimeEnabled: false,
      isRestEnabled: false,
      remark: null,
      managementFlag: 1,
      cardNumber: null,
      picture: null,
      userFlag: 0,
      groupId: 1,
      classFlag: 0,
      otherInfo: null,
      adminGroupId: 0,
    });
    try {
      await this.repository.save(user);
    } catch (error) {
      if (!failIfExists && this.isDuplicateKeyError(error)) {
        return { created: false, userId: biometricId };
      }
      throw error;
    }
    return { created: true, userId: user.userId };
  }

  async findAll(filters: ListWatchUsersDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const query = this.repository.createQueryBuilder('watchUser');
    if (filters.search?.trim()) {
      const search = `%${filters.search.trim()}%`;
      query.andWhere(
        new Brackets((where) => {
          where.where('watchUser.userId LIKE :search', { search })
            .orWhere('watchUser.userCode LIKE :search', { search })
            .orWhere('watchUser.name LIKE :search', { search })
            .orWhere('watchUser.idCard LIKE :search', { search });
        }),
      );
    }
    query.orderBy('watchUser.name', 'ASC').addOrderBy('watchUser.userId', 'ASC');
    const [data, total] = await query.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(userId: string) {
    const user = await this.repository.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('Usuario del reloj no encontrado.');
    return user;
  }

  private normalizeSex(value: string | null | undefined) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['m', 'masculino', 'male', 'hombre'].includes(normalized)) return 'male';
    if (['f', 'femenino', 'female', 'mujer'].includes(normalized)) return 'female';
    return null;
  }

  private limit(value: string | null | undefined, maximumLength: number) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.slice(0, maximumLength) : null;
  }

  private isDuplicateKeyError(error: unknown) {
    const candidate = error as { number?: number; code?: string; message?: string; driverError?: { number?: number; code?: string; message?: string } };
    const number = candidate?.number ?? candidate?.driverError?.number;
    const code = candidate?.code ?? candidate?.driverError?.code;
    const message = `${candidate?.message || ''} ${candidate?.driverError?.message || ''}`;
    return number === 2601 || number === 2627 || code === 'EREQUEST' && /duplicate key|primary key/i.test(message);
  }
}
