import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Not, Repository } from 'typeorm';
import { PrinterService } from '../../common/printer/printer.service';
import { sendRequestNotification } from '../../common/helpers/send-email.helper';
import { VacationPeriodStatus } from '../../common/enums/vacation.enums';
import { Components } from '../components/entities/components.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { EmployeeUnpaidLeave } from '../employees/entities/employee-unpaid-leave.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Holiday } from '../holiday/entities/holiday.entity';
import { RegionalManagerService } from '../area-manager/regional-manager.service';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { User } from '../users/entities/user.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveVacationImpact } from './entities/leave-vacation-impact.entity';
import {
  LeaveRequestStage,
  LeaveRequestStatus,
  LeaveRequestType,
} from './enums/leave-request.enums';
import { buildLeaveRequestReport } from './reports/leave-request.report';

@Injectable()
export class LeaveRequestsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LeaveRequest)
    private readonly requestRepository: Repository<LeaveRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Holiday)
    private readonly holidayRepository: Repository<Holiday>,
    @InjectRepository(Components)
    private readonly componentRepository: Repository<Components>,
    @InjectRepository(RolUser)
    private readonly roleUserRepository: Repository<RolUser>,
    private readonly regionalManagerService: RegionalManagerService,
    private readonly configService: ConfigService,
    private readonly printerService: PrinterService,
  ) {}

  async initializeModule() {
    await this.dataSource.query(
      'CREATE SEQUENCE IF NOT EXISTS leave_request_number_seq START WITH 1 INCREMENT BY 1',
    );
    await this.ensurePermissionComponent();
  }

  async ensurePermissionComponent() {
    const systemId = this.configService.get<string>(
      'DEFAULT_SYSTEM_ID',
      '6816a2e5-085a-4d96-8a36-a8546d886051',
    );
    const existing = await this.componentRepository.findOne({
      where: { system_id: systemId, description: 'Licencias' },
    });
    if (existing) return existing;

    const last = await this.componentRepository.findOne({
      where: { system_id: systemId },
      order: { orden: 'DESC' },
    });
    return this.componentRepository.save(
      this.componentRepository.create({
        description: 'Licencias',
        system_id: systemId,
        orden: Number(last?.orden || 0) + 1,
        visible: true,
      }),
    );
  }

  async create(requesterId: string, dto: CreateLeaveRequestDto) {
    const employee = await this.resolveEmployee(requesterId);
    const startDate = this.normalizeDate(dto.startDate);
    const endDate = this.normalizeDate(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('La fecha final no puede ser anterior a la fecha inicial.');
    }

    const activeJob = employee.jobRecords?.find(
      (record) => String(record.status || '').toLowerCase() === 'active',
    );
    if (!activeJob?.area_id || !employee.regional_id) {
      throw new BadRequestException('El empleado no tiene área y regional activas configuradas.');
    }

    const businessDays = await this.countBusinessDays(startDate, endDate);
    if (businessDays <= 0) {
      throw new BadRequestException('El rango debe contener al menos un día laboral.');
    }

    const overlapping = await this.requestRepository
      .createQueryBuilder('request')
      .where('request.employee_id = :employeeId', { employeeId: employee.id })
      .andWhere('request.status != :rejected', { rejected: LeaveRequestStatus.REJECTED })
      .andWhere('request.start_date <= :endDate AND request.end_date >= :startDate', {
        startDate,
        endDate,
      })
      .getExists();
    if (overlapping) {
      throw new BadRequestException('Ya existe una licencia activa que se cruza con ese rango.');
    }

    const sequence = await this.dataSource.query(
      `SELECT nextval('leave_request_number_seq') AS value`,
    );
    const requestNumber = `SOL-${String(sequence[0].value).padStart(6, '0')}`;
    const type = businessDays <= 3 ? LeaveRequestType.PAID : LeaveRequestType.UNPAID;

    const saved = await this.requestRepository.save(
      this.requestRepository.create({
        requestNumber,
        employeeId: employee.id,
        areaId: activeJob.area_id,
        regionalId: employee.regional_id,
        startDate,
        endDate,
        businessDays,
        type,
        reason: dto.reason.trim(),
        stage: LeaveRequestStage.HR_REVIEW,
        status: LeaveRequestStatus.PENDING,
        hrEmployeeId: null,
        hrStatus: LeaveRequestStatus.PENDING,
        hrObservation: null,
        hrReviewedAt: null,
        directorEmployeeId: null,
        directorStatus: LeaveRequestStatus.PENDING,
        directorObservation: null,
        directorReviewedAt: null,
        vacationImpactApplied: false,
        vacationImpactAppliedAt: null,
      }),
    );

    await sendRequestNotification(
      employee.email,
      `Solicitud ${requestNumber} registrada`,
      this.employeeName(employee),
      `Su solicitud de licencia ${type === LeaveRequestType.PAID ? 'remunerada' : 'no remunerada'} fue enviada a Recursos Humanos.`,
      [`Días laborales: ${businessDays}`, `Período: ${startDate} al ${endDate}`],
    );

    return this.findOneForEmployee(saved.id, requesterId);
  }

  async findMine(requesterId: string) {
    const employee = await this.resolveEmployee(requesterId);
    return this.requestRepository.find({
      where: { employeeId: employee.id },
      relations: { area: true, vacationImpacts: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findHrInbox(requesterId: string, query: ListLeaveRequestsDto) {
    await this.assertHrAccess(requesterId);
    return this.findInbox(query, 'HR', null);
  }

  async findDirectorInbox(requesterId: string, query: ListLeaveRequestsDto) {
    const employee = await this.resolveEmployee(requesterId);
    await this.assertMainDirector(employee.id);
    return this.findInbox(query, 'DIRECTOR', employee.id);
  }

  async getDirectorAccess(requesterId: string) {
    const employee = await this.resolveEmployee(requesterId);
    const director = await this.getMainDirector();
    return {
      hasAccess: director.employee_id === employee.id,
      employeeId: employee.id,
      roleLabel: director.employee_id === employee.id ? 'Director General' : null,
    };
  }

  async reviewByHr(requesterId: string, id: string, dto: ReviewLeaveRequestDto) {
    await this.assertHrAccess(requesterId);
    const reviewer = await this.resolveEmployee(requesterId);
    this.assertDecision(dto.status);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const request = await runner.manager.findOne(LeaveRequest, {
        where: { id },
        relations: { employee: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw new NotFoundException('Solicitud de licencia no encontrada.');
      if (request.stage !== LeaveRequestStage.HR_REVIEW || request.status !== LeaveRequestStatus.PENDING) {
        throw new BadRequestException('La solicitud ya no está pendiente de Recursos Humanos.');
      }

      request.hrEmployeeId = reviewer.id;
      request.hrStatus = dto.status;
      request.hrObservation = dto.observation?.trim() || null;
      request.hrReviewedAt = new Date();

      if (dto.status === LeaveRequestStatus.REJECTED) {
        request.stage = LeaveRequestStage.COMPLETED;
        request.status = LeaveRequestStatus.REJECTED;
      } else if (request.type === LeaveRequestType.PAID) {
        request.stage = LeaveRequestStage.COMPLETED;
        request.status = LeaveRequestStatus.APPROVED;
      } else {
        const director = await this.getMainDirector();
        if (director.employee_id === request.employeeId) {
          throw new BadRequestException('El Director General no puede autorizar su propia licencia.');
        }
        request.directorEmployeeId = director.employee_id;
        request.stage = LeaveRequestStage.DIRECTOR_REVIEW;
        request.status = LeaveRequestStatus.PENDING;
      }

      await runner.manager.save(request);
      await runner.commitTransaction();

      await this.notifyAfterHrReview(request);
      return this.getById(request.id);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async reviewByDirector(requesterId: string, id: string, dto: ReviewLeaveRequestDto) {
    const director = await this.resolveEmployee(requesterId);
    await this.assertMainDirector(director.id);
    this.assertDecision(dto.status);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const request = await runner.manager.findOne(LeaveRequest, {
        where: { id },
        relations: { employee: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw new NotFoundException('Solicitud de licencia no encontrada.');
      if (
        request.stage !== LeaveRequestStage.DIRECTOR_REVIEW ||
        request.status !== LeaveRequestStatus.PENDING ||
        request.directorEmployeeId !== director.id
      ) {
        throw new ForbiddenException('No puede revisar esta solicitud de licencia.');
      }

      request.directorStatus = dto.status;
      request.directorObservation = dto.observation?.trim() || null;
      request.directorReviewedAt = new Date();
      request.stage = LeaveRequestStage.COMPLETED;
      request.status = dto.status;

      if (dto.status === LeaveRequestStatus.APPROVED) {
        await this.applyUnpaidLeaveImpact(request, runner.manager);
      }

      await runner.manager.save(request);
      await runner.commitTransaction();

      await this.notifyFinalDecision(request);
      return this.getById(request.id);
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  async generatePdf(requesterId: string, id: string, destination: 'HR' | 'DIRECTOR') {
    const request = await this.getById(id);
    const employee = await this.resolveEmployee(requesterId);
    const isOwner = employee.id === request.employeeId;
    const isDirector = request.directorEmployeeId === employee.id;
    let isHr = false;
    try {
      await this.assertHrAccess(requesterId);
      isHr = true;
    } catch {}

    if (!isOwner && !isDirector && !isHr) {
      throw new ForbiddenException('No tiene permiso para consultar este documento.');
    }
    if (destination === 'DIRECTOR' && request.hrStatus !== LeaveRequestStatus.APPROVED) {
      throw new BadRequestException('El documento para Dirección aún no está disponible.');
    }

    return {
      requestNumber: request.requestNumber,
      pdf: this.printerService.createPdf(buildLeaveRequestReport(request, destination)),
    };
  }

  async getById(id: string) {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: {
        employee: true,
        area: true,
        regional: true,
        hrEmployee: true,
        directorEmployee: true,
        vacationImpacts: true,
      },
    });
    if (!request) throw new NotFoundException('Solicitud de licencia no encontrada.');
    return request;
  }

  private async findOneForEmployee(id: string, requesterId: string) {
    const request = await this.getById(id);
    const employee = await this.resolveEmployee(requesterId);
    if (request.employeeId !== employee.id) throw new ForbiddenException();
    return request;
  }

  private async findInbox(query: ListLeaveRequestsDto, reviewer: 'HR' | 'DIRECTOR', directorId: string | null) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 50);
    const builder = this.requestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .innerJoinAndSelect('request.area', 'area')
      .innerJoinAndSelect('request.regional', 'regional');

    if (directorId) builder.andWhere('request.director_employee_id = :directorId', { directorId });
    if (reviewer === 'DIRECTOR') builder.andWhere('request.type = :unpaid', { unpaid: LeaveRequestType.UNPAID });
    this.applyInboxStatus(builder, query.status || 'pending', reviewer);

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(new Brackets((qb) => {
        qb.where('LOWER(request.request_number) LIKE :search', { search })
          .orWhere('LOWER(employee.firstName) LIKE :search', { search })
          .orWhere('LOWER(employee.lastName) LIKE :search', { search })
          .orWhere('LOWER(area.name) LIKE :search', { search });
      }));
    }
    builder.orderBy('request.created_at', 'DESC');
    const [data, total] = await builder.skip((page - 1) * limit).take(limit).getManyAndCount();
    const scope = this.requestRepository.createQueryBuilder('request');
    if (directorId) scope.where('request.director_employee_id = :directorId', { directorId });
    const pendingStageForReviewer = reviewer === 'HR'
      ? LeaveRequestStage.HR_REVIEW
      : LeaveRequestStage.DIRECTOR_REVIEW;
    const [pending, approved, rejected, directorPending, completed] = await Promise.all([
      scope.clone().andWhere(reviewer === 'HR' ? 'request.hr_status = :pending' : 'request.director_status = :pending', { pending: LeaveRequestStatus.PENDING }).andWhere('request.stage = :stage', { stage: pendingStageForReviewer }).getCount(),
      scope.clone().andWhere(reviewer === 'HR' ? 'request.hr_status = :approved' : 'request.director_status = :approved', { approved: LeaveRequestStatus.APPROVED }).getCount(),
      scope.clone().andWhere(reviewer === 'HR' ? 'request.hr_status = :rejected' : 'request.director_status = :rejected', { rejected: LeaveRequestStatus.REJECTED }).getCount(),
      scope.clone().andWhere('request.stage = :directorStage', { directorStage: LeaveRequestStage.DIRECTOR_REVIEW }).getCount(),
      scope.clone().andWhere('request.stage = :completedStage', { completedStage: LeaveRequestStage.COMPLETED }).getCount(),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      stats: { pending, approved, rejected, directorPending, completed, total: await scope.clone().getCount() },
    };
  }

  private applyInboxStatus(builder: any, status: string, reviewer: 'HR' | 'DIRECTOR') {
    const statusColumn = reviewer === 'HR' ? 'request.hr_status' : 'request.director_status';
    const pendingStage = reviewer === 'HR' ? LeaveRequestStage.HR_REVIEW : LeaveRequestStage.DIRECTOR_REVIEW;
    if (status === 'pending') return builder.andWhere(`${statusColumn} = :filterStatus`, { filterStatus: LeaveRequestStatus.PENDING }).andWhere('request.stage = :pendingStage', { pendingStage });
    if (status === 'approved') return builder.andWhere(`${statusColumn} = :filterStatus`, { filterStatus: LeaveRequestStatus.APPROVED });
    if (status === 'rejected') return builder.andWhere(`${statusColumn} = :filterStatus`, { filterStatus: LeaveRequestStatus.REJECTED });
    return builder;
  }

  private async applyUnpaidLeaveImpact(request: LeaveRequest, manager: any) {
    if (request.type !== LeaveRequestType.UNPAID || request.vacationImpactApplied) return;

    await manager.insert(EmployeeUnpaidLeave, {
      employeeId: request.employeeId,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.businessDays,
      observation: `Licencia ${request.requestNumber}: ${request.reason}`,
    });

    const periods = await manager.find(EmployeeVacationPeriod, {
      where: {
        employeeId: request.employeeId,
        status: In([VacationPeriodStatus.AVAILABLE, VacationPeriodStatus.PENDING]),
      },
      order: { periodNumber: 'ASC' },
    });
    const firstIndex = periods.findIndex(
      (period: EmployeeVacationPeriod) =>
        request.startDate <= period.accreditationDate && request.endDate >= period.startDate,
    );

    if (firstIndex >= 0) {
      for (const period of periods.slice(firstIndex)) {
        const oldEndDate = period.endDate;
        const oldAccreditationDate = period.accreditationDate;
        period.endDate = this.addCalendarDays(oldEndDate, request.businessDays);
        period.accreditationDate = this.addCalendarDays(oldAccreditationDate, request.businessDays);
        await manager.save(EmployeeVacationPeriod, period);
        await manager.insert(LeaveVacationImpact, {
          leaveRequestId: request.id,
          vacationPeriodId: period.id,
          oldEndDate,
          newEndDate: period.endDate,
          oldAccreditationDate,
          newAccreditationDate: period.accreditationDate,
          shiftDays: request.businessDays,
        });
      }
    }
    request.vacationImpactApplied = true;
    request.vacationImpactAppliedAt = new Date();
  }

  private async countBusinessDays(startDate: string, endDate: string) {
    const holidays = await this.holidayRepository
      .createQueryBuilder('holiday')
      .select('holiday.date', 'date')
      .where('holiday.is_active = true')
      .andWhere('holiday.date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawMany<{ date: string }>();
    const holidayDates = new Set(holidays.map((item) => String(item.date).slice(0, 10)));
    let count = 0;
    for (let date = this.dateAtNoon(startDate); date <= this.dateAtNoon(endDate); date.setDate(date.getDate() + 1)) {
      const iso = this.serializeDate(date);
      if (date.getDay() !== 0 && date.getDay() !== 6 && !holidayDates.has(iso)) count += 1;
    }
    return count;
  }

  private async resolveEmployee(requesterId: string) {
    const user = await this.userRepository.findOne({
      where: { id: requesterId },
      relations: { employee: { regional: true, jobRecords: { area: true } } },
    });
    if (!user?.employee) throw new NotFoundException('No se encontró el empleado del usuario autenticado.');
    return user.employee;
  }

  private async assertHrAccess(requesterId: string) {
    const count = await this.roleUserRepository
      .createQueryBuilder('permission')
      .innerJoin('permission.components', 'component')
      .where('permission.user_id = :requesterId', { requesterId })
      .andWhere('component.description = :description', { description: 'Licencias' })
      .getCount();
    if (!count) throw new ForbiddenException('No tiene permiso para administrar licencias.');
  }

  private async getMainDirector() {
    const records = await this.regionalManagerService.findAll();
    const main = records.find((item) => item.isMainOffice);
    if (!main) throw new BadRequestException('No hay Director General configurado para la oficina principal.');
    return { employee_id: main.employeeId, employee: { email: main.employeeEmail, firstName: main.employeeName } as Employee };
  }

  private async assertMainDirector(employeeId: string) {
    const director = await this.getMainDirector();
    if (director.employee_id !== employeeId) throw new ForbiddenException('Acceso exclusivo del Director General.');
  }

  private async notifyAfterHrReview(request: LeaveRequest) {
    if (request.hrStatus === LeaveRequestStatus.REJECTED || request.type === LeaveRequestType.PAID) {
      return this.notifyFinalDecision(request);
    }
    const director = await this.getMainDirector();
    await Promise.all([
      sendRequestNotification(request.employee.email, `${request.requestNumber} aprobada por RR. HH.`, this.employeeName(request.employee), 'Recursos Humanos aprobó su licencia no remunerada. Ahora está pendiente de la decisión del Director General.'),
      sendRequestNotification(director.employee.email, `Licencia ${request.requestNumber} pendiente`, this.employeeName(director.employee), 'Tiene una solicitud de licencia no remunerada pendiente de revisión por Dirección General.', [`Empleado: ${this.employeeName(request.employee)}`, `Días laborales: ${request.businessDays}`], 'https://sigerh.senasa.gob.hn/leave-director-requests/pending'),
    ]);
  }

  private async notifyFinalDecision(request: LeaveRequest) {
    return sendRequestNotification(
      request.employee.email,
      `Licencia ${request.requestNumber} ${request.status === LeaveRequestStatus.APPROVED ? 'aprobada' : 'denegada'}`,
      this.employeeName(request.employee),
      request.status === LeaveRequestStatus.APPROVED ? 'Su solicitud de licencia fue aprobada definitivamente.' : 'Su solicitud de licencia fue denegada.',
      [request.directorObservation || request.hrObservation].filter(Boolean) as string[],
    );
  }

  private assertDecision(status: LeaveRequestStatus) {
    if (![LeaveRequestStatus.APPROVED, LeaveRequestStatus.REJECTED].includes(status)) throw new BadRequestException('Solo puede aprobar o denegar.');
  }

  private employeeName(employee: Employee) {
    return [employee?.firstName, employee?.middleName, employee?.lastName, employee?.secondLastName].filter(Boolean).join(' ') || 'Empleado';
  }

  private normalizeDate(value: string) {
    const normalized = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(this.dateAtNoon(normalized).getTime())) throw new BadRequestException('Fecha inválida.');
    return normalized;
  }

  private dateAtNoon(value: string) { return new Date(`${value}T12:00:00`); }
  private serializeDate(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
  private addCalendarDays(value: string, days: number) { const date = this.dateAtNoon(value); date.setDate(date.getDate() + days); return this.serializeDate(date); }
}
