import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { PrinterService } from '../../common/printer/printer.service';
import { sendRequestNotification } from '../../common/helpers/send-email.helper';
import { VacationPeriodStatus } from '../../common/enums/vacation.enums';
import { Components } from '../components/entities/components.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { EmployeeUnpaidLeave } from '../employees/entities/employee-unpaid-leave.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Holiday } from '../holiday/entities/holiday.entity';
import { RegionalManagerService } from '../area-manager/regional-manager.service';
import { AreaManagerService } from '../area-manager/area-manager.service';
import { AreaManagerRole } from '../area-manager/interfaces/area-manager-role.enum';
import { ApprovalRoutingService } from '../area-manager/approval-routing.service';
import { StorageService } from '../../common/services/storage.service';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { User } from '../users/entities/user.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveVacationImpact } from './entities/leave-vacation-impact.entity';
import { LeaveRequestDocument } from './entities/leave-request-document.entity';
import {
  LeaveRequestStage,
  LeaveRequestStatus,
  LeaveRequestType,
  LeaveReasonType,
  LeaveRelationship,
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
    @InjectRepository(LeaveRequestDocument)
    private readonly documentRepository: Repository<LeaveRequestDocument>,
    private readonly regionalManagerService: RegionalManagerService,
    private readonly areaManagerService: AreaManagerService,
    private readonly approvalRoutingService: ApprovalRoutingService,
    private readonly configService: ConfigService,
    private readonly printerService: PrinterService,
    private readonly storageService: StorageService,
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
      .where('request.employeeId = :employeeId', { employeeId: employee.id })
      .andWhere('request.status != :rejected', { rejected: LeaveRequestStatus.REJECTED })
      .andWhere('request.startDate <= :endDate AND request.endDate >= :startDate', {
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
    const type = dto.type;
    this.validateLegalRequest(dto, businessDays);

    const regionalManager = await this.regionalManagerService.findActiveByRegional(employee.regional_id);
    const areaApproval = await this.approvalRoutingService.resolveAreaOrMainManager(
      employee.id,
      activeJob.area_id,
      employee.regional_id,
    );
    const isMainOffice = Boolean(employee.regional?.is_main_office);
    if (!isMainOffice && !regionalManager) {
      throw new BadRequestException('No existe un jefe regional activo para la regional del empleado.');
    }

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
        reasonType: dto.reasonType,
        relationship: dto.relationship || null,
        differentDomicile: Boolean(dto.differentDomicile),
        reason: dto.reason.trim(),
        stage: isMainOffice
          ? LeaveRequestStage.AREA_REVIEW
          : LeaveRequestStage.REGIONAL_REVIEW,
        status: LeaveRequestStatus.PENDING,
        regionalManagerEmployeeId: isMainOffice ? null : regionalManager!.employee_id,
        regionalStatus: LeaveRequestStatus.PENDING,
        regionalObservation: null,
        regionalReviewedAt: null,
        areaManagerEmployeeId: areaApproval.employeeId,
        areaStatus: LeaveRequestStatus.PENDING,
        areaObservation: null,
        areaReviewedAt: null,
        hrEmployeeId: null,
        hrStatus: LeaveRequestStatus.PENDING,
        hrObservation: null,
        hrReviewedAt: null,
        liaisonReviewRequired: false,
        liaisonEmployeeId: null,
        liaisonStatus: null,
        liaisonObservation: null,
        liaisonReviewedAt: null,
        directorEmployeeId: null,
        directorStatus: LeaveRequestStatus.PENDING,
        directorObservation: null,
        directorReviewedAt: null,
        vacationImpactApplied: false,
        vacationImpactAppliedAt: null,
      }),
    );

    const documents = dto.documents || [];
    for (const document of documents) {
      const extension = this.extensionForMime(document.mimeType);
      const filePath = this.storageService.saveBase64File(
        document.base64,
        `leave-requests/${saved.id}`,
        `${document.code}-${saved.id}.${extension}`,
      );
      await this.documentRepository.save(this.documentRepository.create({
        leaveRequestId: saved.id,
        code: document.code,
        originalName: document.name,
        mimeType: document.mimeType,
        filePath,
      }));
    }

    await sendRequestNotification(
      employee.email,
      `Solicitud ${requestNumber} registrada`,
      this.employeeName(employee),
      `Su solicitud de licencia ${type === LeaveRequestType.PAID ? 'remunerada' : 'no remunerada'} fue enviada al primer nivel de aprobación.`,
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

  async findManagerInbox(requesterId: string, query: ListLeaveRequestsDto) {
    const employee = await this.resolveEmployee(requesterId);
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 50);
    const builder = this.requestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .innerJoinAndSelect('request.area', 'area')
      .innerJoinAndSelect('request.regional', 'regional')
      .leftJoinAndSelect('request.documents', 'documents');
    if (query.status === 'approved') {
      builder.where(`(
        (request.regionalManagerEmployeeId = :employeeId AND request.regionalStatus = :approved)
        OR (request.areaManagerEmployeeId = :employeeId AND request.areaStatus = :approved)
      )`, { employeeId: employee.id, approved: LeaveRequestStatus.APPROVED });
    } else if (query.status === 'rejected') {
      builder.where(`(
        (request.regionalManagerEmployeeId = :employeeId AND request.regionalStatus = :rejected)
        OR (request.areaManagerEmployeeId = :employeeId AND request.areaStatus = :rejected)
      )`, { employeeId: employee.id, rejected: LeaveRequestStatus.REJECTED });
    } else if ((query.status || 'pending') === 'pending') {
      builder.where(`(
        (request.stage = :regionalStage AND request.regionalManagerEmployeeId = :employeeId)
        OR (request.stage = :areaStage AND request.areaManagerEmployeeId = :employeeId)
      )`, {
        regionalStage: LeaveRequestStage.REGIONAL_REVIEW,
        areaStage: LeaveRequestStage.AREA_REVIEW,
        employeeId: employee.id,
      }).andWhere('request.status = :pending', { pending: LeaveRequestStatus.PENDING });
    }
    builder.orderBy('request.createdAt', 'DESC');
    const [data, total] = await builder.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async reviewByManager(requesterId: string, id: string, dto: ReviewLeaveRequestDto) {
    const reviewer = await this.resolveEmployee(requesterId);
    this.assertDecision(dto.status);
    const request = await this.requestRepository.findOne({ where: { id }, relations: { employee: true, regional: true } });
    if (!request) throw new NotFoundException('Solicitud de licencia no encontrada.');
    if (request.status !== LeaveRequestStatus.PENDING) throw new BadRequestException('La solicitud ya fue procesada.');

    const isRegionalStep = request.stage === LeaveRequestStage.REGIONAL_REVIEW;
    const isAreaStep = request.stage === LeaveRequestStage.AREA_REVIEW;
    const assignedId = isRegionalStep ? request.regionalManagerEmployeeId : request.areaManagerEmployeeId;
    if ((!isRegionalStep && !isAreaStep) || assignedId !== reviewer.id) {
      throw new ForbiddenException('No tiene autorización para revisar esta licencia.');
    }

    const now = new Date();
    if (isRegionalStep) {
      request.regionalStatus = dto.status;
      request.regionalObservation = dto.observation?.trim() || null;
      request.regionalReviewedAt = now;
    } else {
      request.areaStatus = dto.status;
      request.areaObservation = dto.observation?.trim() || null;
      request.areaReviewedAt = now;
    }

    if (dto.status === LeaveRequestStatus.REJECTED) {
      request.status = LeaveRequestStatus.REJECTED;
      request.stage = LeaveRequestStage.COMPLETED;
    } else {
      request.stage = isRegionalStep
        ? LeaveRequestStage.AREA_REVIEW
        : LeaveRequestStage.HR_REVIEW;
      if (!isRegionalStep) await this.prepareLiaisonReview(request);
    }
    await this.requestRepository.save(request);
    await sendRequestNotification(
      request.employee.email,
      `Licencia ${request.requestNumber} ${dto.status === LeaveRequestStatus.APPROVED ? 'aprobada' : 'denegada'}`,
      this.employeeName(request.employee),
      dto.status === LeaveRequestStatus.APPROVED
        ? `La solicitud avanzó al siguiente nivel de aprobación.`
        : 'La solicitud fue denegada.',
      dto.observation ? [`Observación: ${dto.observation}`] : [],
    );
    return this.getById(id);
  }

  async findDirectorInbox(requesterId: string, query: ListLeaveRequestsDto) {
    const employee = await this.resolveEmployee(requesterId);
    await this.assertMainDirector(employee.id);
    return this.findInbox(query, 'DIRECTOR', employee.id);
  }

  async findLiaisonInbox(requesterId: string) {
    const employee = await this.resolveEmployee(requesterId);
    const access = await this.regionalManagerService.getHrLiaisonAccess(employee.id);
    const regionalIds = access.assignments.filter((item) => item.permissions.leaves).map((item) => item.regionalId);
    if (!regionalIds.length) return [];
    const requests = await this.requestRepository.find({
      where: regionalIds.map((regionalId) => ({
        regionalId,
        stage: LeaveRequestStage.HR_REVIEW,
        status: LeaveRequestStatus.PENDING,
        liaisonReviewRequired: true,
        liaisonStatus: 'PENDING',
      })),
      relations: { employee: true, area: true, documents: true },
      order: { createdAt: 'DESC' },
    });
    return requests.map((request) => ({
      id: request.id,
      requestType: 'leave',
      requestNumber: request.requestNumber,
      employeeName: this.employeeName(request.employee),
      areaName: request.area?.name || 'Sin área',
      regionalId: request.regionalId,
      startDate: request.startDate,
      endDate: request.endDate,
      days: request.businessDays,
      reason: request.reason,
      leaveType: request.type,
      reasonType: request.reasonType,
      documents: request.documents,
      canApproveFinally: false,
      createdAt: request.createdAt,
    }));
  }

  async reviewByLiaison(requesterId: string, id: string, dto: ReviewLeaveRequestDto) {
    const reviewer = await this.resolveEmployee(requesterId);
    this.assertDecision(dto.status);
    const request = await this.requestRepository.findOne({ where: { id }, relations: { employee: true } });
    if (!request || request.stage !== LeaveRequestStage.HR_REVIEW || request.liaisonStatus !== 'PENDING') {
      throw new BadRequestException('La licencia ya no está pendiente del enlace de RR. HH.');
    }
    const liaisons = await this.regionalManagerService.findActiveHrLiaisonsByPermission(request.regionalId, 'leaves');
    if (!liaisons.some((item) => item.employee_id === reviewer.id)) throw new ForbiddenException('No tiene permiso para revisar esta licencia.');
    request.liaisonEmployeeId = reviewer.id;
    request.liaisonStatus = dto.status;
    request.liaisonObservation = dto.observation?.trim() || null;
    request.liaisonReviewedAt = new Date();
    if (dto.status === LeaveRequestStatus.REJECTED) {
      request.stage = LeaveRequestStage.COMPLETED;
      request.status = LeaveRequestStatus.REJECTED;
    }
    await this.requestRepository.save(request);
    await sendRequestNotification(request.employee.email, `Licencia ${request.requestNumber} revisada`, this.employeeName(request.employee),
      dto.status === LeaveRequestStatus.APPROVED
        ? 'El enlace regional de Recursos Humanos emitió revisión favorable. La solicitud continúa a RR. HH. central.'
        : 'El enlace regional de Recursos Humanos denegó su solicitud.', dto.observation ? [`Observación: ${dto.observation}`] : []);
    return this.getById(id);
  }

  private async prepareLiaisonReview(request: LeaveRequest) {
    const liaisons = await this.regionalManagerService.findActiveHrLiaisonsByPermission(request.regionalId, 'leaves');
    request.liaisonReviewRequired = liaisons.length > 0;
    request.liaisonStatus = liaisons.length ? 'PENDING' : null;
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
      const request = await runner.manager
        .createQueryBuilder(LeaveRequest, 'request')
        .setLock('pessimistic_write')
        .where('request.id = :id', { id })
        .getOne();
      if (!request) throw new NotFoundException('Solicitud de licencia no encontrada.');
      request.employee = await runner.manager.findOneByOrFail(Employee, { id: request.employeeId });
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
      const request = await runner.manager
        .createQueryBuilder(LeaveRequest, 'request')
        .setLock('pessimistic_write')
        .where('request.id = :id', { id })
        .getOne();
      if (!request) throw new NotFoundException('Solicitud de licencia no encontrada.');
      request.employee = await runner.manager.findOneByOrFail(Employee, { id: request.employeeId });
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

  async getDocument(requesterId: string, requestId: string, documentId: string) {
    const request = await this.getById(requestId);
    const employee = await this.resolveEmployee(requesterId);
    const isAssignedManager = request.regionalManagerEmployeeId === employee.id || request.areaManagerEmployeeId === employee.id;
    const isOwner = request.employeeId === employee.id;
    const isDirector = request.directorEmployeeId === employee.id;
    let isHr = false;
    try { await this.assertHrAccess(requesterId); isHr = true; } catch {}
    if (!isOwner && !isAssignedManager && !isDirector && !isHr) {
      throw new ForbiddenException('No tiene permiso para consultar este documento.');
    }
    const document = request.documents?.find((item) => item.id === documentId);
    if (!document) throw new NotFoundException('Documento adjunto no encontrado.');
    return { ...document, absolutePath: this.storageService.getAbsolutePath(document.filePath) };
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
        documents: true,
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
      .innerJoinAndSelect('request.regional', 'regional')
      .leftJoinAndSelect('request.documents', 'documents');

    if (reviewer === 'HR') {
      builder.andWhere('(request.liaisonReviewRequired = false OR request.liaisonStatus = :liaisonApproved OR request.status <> :liaisonPending)', {
        liaisonApproved: LeaveRequestStatus.APPROVED,
        liaisonPending: LeaveRequestStatus.PENDING,
      });
    }

    if (directorId) builder.andWhere('request.directorEmployeeId = :directorId', { directorId });
    if (reviewer === 'DIRECTOR') builder.andWhere('request.type = :unpaid', { unpaid: LeaveRequestType.UNPAID });
    this.applyInboxStatus(builder, query.status || 'pending', reviewer);

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      builder.andWhere(new Brackets((qb) => {
        qb.where('LOWER(request.requestNumber) LIKE :search', { search })
          .orWhere('LOWER(employee.firstName) LIKE :search', { search })
          .orWhere('LOWER(employee.lastName) LIKE :search', { search })
          .orWhere('LOWER(area.name) LIKE :search', { search });
      }));
    }
    builder.orderBy('request.createdAt', 'DESC');
    const [data, total] = await builder.skip((page - 1) * limit).take(limit).getManyAndCount();
    const scope = this.requestRepository.createQueryBuilder('request');
    if (reviewer === 'HR') {
      scope.andWhere('(request.liaisonReviewRequired = false OR request.liaisonStatus = :liaisonApproved OR request.status <> :liaisonPending)', {
        liaisonApproved: LeaveRequestStatus.APPROVED,
        liaisonPending: LeaveRequestStatus.PENDING,
      });
    }
    if (directorId) scope.where('request.directorEmployeeId = :directorId', { directorId });
    const pendingStageForReviewer = reviewer === 'HR'
      ? LeaveRequestStage.HR_REVIEW
      : LeaveRequestStage.DIRECTOR_REVIEW;
    const [pending, approved, rejected, directorPending, completed] = await Promise.all([
      scope.clone().andWhere(reviewer === 'HR' ? 'request.hrStatus = :pending' : 'request.directorStatus = :pending', { pending: LeaveRequestStatus.PENDING }).andWhere('request.stage = :stage', { stage: pendingStageForReviewer }).getCount(),
      scope.clone().andWhere(reviewer === 'HR' ? 'request.hrStatus = :approved' : 'request.directorStatus = :approved', { approved: LeaveRequestStatus.APPROVED }).getCount(),
      scope.clone().andWhere(reviewer === 'HR' ? 'request.hrStatus = :rejected' : 'request.directorStatus = :rejected', { rejected: LeaveRequestStatus.REJECTED }).getCount(),
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
    const statusColumn = reviewer === 'HR' ? 'request.hrStatus' : 'request.directorStatus';
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

  private validateLegalRequest(dto: CreateLeaveRequestDto, businessDays: number) {
    const requiredCodes: Record<LeaveReasonType, string[]> = {
      [LeaveReasonType.DEATH]: ['DEATH_CERTIFICATE', 'BIRTH_CERTIFICATE'],
      [LeaveReasonType.PERSONAL]: [],
      [LeaveReasonType.IHSS]: dto.relationship === LeaveRelationship.SELF
        ? ['IHSS_CERTIFICATE']
        : ['IHSS_CERTIFICATE', 'BIRTH_CERTIFICATE'],
    };
    const received = new Set((dto.documents || []).map((item) => item.code));
    const missing = requiredCodes[dto.reasonType].filter((code) => !received.has(code));
    if (missing.length) throw new BadRequestException('Debe adjuntar todos los documentos requeridos para este tipo de licencia.');
    if (dto.reasonType === LeaveReasonType.DEATH) {
      if (dto.relationship === LeaveRelationship.SELF) {
        throw new BadRequestException('El parentesco "El empleado" no aplica para una licencia por fallecimiento.');
      }
      const maximum = dto.differentDomicile ? 9 : 5;
      if (businessDays > maximum) throw new BadRequestException(`La licencia por fallecimiento permite hasta ${maximum} días hábiles.`);
    }
    for (const document of dto.documents || []) {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(document.mimeType)) {
        throw new BadRequestException('Los documentos deben ser PDF, JPG o PNG.');
      }
      const payload = document.base64.split(',').pop() || '';
      if (Buffer.byteLength(payload, 'base64') > 10 * 1024 * 1024) {
        throw new BadRequestException('Cada documento debe pesar 10 MB o menos.');
      }
    }
  }

  private extensionForMime(mimeType: string) {
    return mimeType === 'application/pdf' ? 'pdf' : mimeType === 'image/png' ? 'png' : 'jpg';
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
