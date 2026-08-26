import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { Components } from '../components/entities/components.entity';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { ConfigService } from '@nestjs/config';
import { EmployeePaymentReceipt } from '../payroll-import/entities/employee-payment-receipt.entity';
import { PayrollItemType } from '../payroll-import/enum/payroll-item-type.enum';
import { PrinterService } from 'src/common/printer/printer.service';
import { EmploymentCertificateReport } from './reports/employment-certificate.report';
import {
  numberToLempirasWords,
  numberToSpanishWords,
} from 'src/common/utils/number-to-spanish-words.util';
import { sendRequestNotification } from 'src/common/helpers/send-email.helper';
import { CreateEmploymentCertificateRequestDto } from './dto/create-employment-certificate-request.dto';
import { ListEmploymentCertificateRequestsDto } from './dto/list-employment-certificate-requests.dto';
import { UpdateEmploymentCertificateStatusDto } from './dto/update-employment-certificate-status.dto';
import { EmploymentCertificateRequest } from './entities/employment-certificate-request.entity';
import { EmploymentCertificateStatus } from './enums/employment-certificate-status.enum';
import {
  EMPLOYMENT_CERTIFICATE_TYPE_LABELS,
  EmploymentCertificateType,
} from './enums/employment-certificate-type.enum';

@Injectable()
export class EmploymentCertificateRequestsService {
  constructor(
    @InjectRepository(EmploymentCertificateRequest)
    private readonly requestRepository: Repository<EmploymentCertificateRequest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Components)
    private readonly componentsRepository: Repository<Components>,
    @InjectRepository(RolUser)
    private readonly roleUserRepository: Repository<RolUser>,
    @InjectRepository(EmployeePaymentReceipt)
    private readonly receiptRepository: Repository<EmployeePaymentReceipt>,
    private readonly configService: ConfigService,
    private readonly printerService: PrinterService,
  ) {}

  async ensurePermissionComponent() {
    const systemId = this.configService.get<string>(
      'DEFAULT_SYSTEM_ID',
      '6816a2e5-085a-4d96-8a36-a8546d886051',
    );
    const existing = await this.componentsRepository.findOne({
      where: { system_id: systemId, description: 'Constancias Laborales' },
    });
    if (existing) return existing;

    const last = await this.componentsRepository.findOne({
      where: { system_id: systemId },
      order: { orden: 'DESC' },
    });
    return this.componentsRepository.save(
      this.componentsRepository.create({
        description: 'Constancias Laborales',
        system_id: systemId,
        orden: Number(last?.orden || 0) + 1,
        visible: true,
      }),
    );
  }

  async create(requesterId: string, dto: CreateEmploymentCertificateRequestDto) {
    const employeeId = await this.resolveEmployeeId(requesterId);

    const activeRequest = await this.requestRepository.findOne({
      where: {
        employeeId,
        type: dto.type,
        status: In([
          EmploymentCertificateStatus.PENDING,
          EmploymentCertificateStatus.IN_PROGRESS,
          EmploymentCertificateStatus.READY,
        ]),
      },
    });
    if (activeRequest) {
      throw new BadRequestException([
        'Ya tienes una solicitud activa para este tipo de constancia.',
      ]);
    }

    if (
      dto.type === EmploymentCertificateType.EMBASSY &&
      (!dto.embassyName?.trim() || !dto.appointmentDate)
    ) {
      throw new BadRequestException([
        'Para una constancia de embajada debes indicar la embajada y la fecha de la cita.',
      ]);
    }

    const request = this.requestRepository.create({
      employeeId,
      type: dto.type,
      embassyName: dto.embassyName?.trim() || null,
      appointmentDate: dto.appointmentDate || null,
      status: EmploymentCertificateStatus.PENDING,
    });

    return this.requestRepository.save(request);
  }

  async findHrInbox(requesterId: string, query: ListEmploymentCertificateRequestsDto) {
    await this.assertHrAccess(requesterId);
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 8);
    const search = query.search?.trim().toLowerCase() || '';

    const builder = this.requestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :activeStatus',
        { activeStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .orderBy('request.createdAt', 'DESC');

    if (query.status) {
      builder.andWhere('request.status = :status', { status: query.status });
    }

    if (search) {
      builder.andWhere(
        `(
          LOWER(COALESCE(employee.firstName, '') || ' ' || COALESCE(employee.middleName, '') || ' ' || COALESCE(employee.lastName, '') || ' ' || COALESCE(employee.secondLastName, '')) LIKE :search
          OR LOWER(COALESCE(employee.dni, '')) LIKE :search
          OR LOWER(COALESCE(employee.biometric_id, '')) LIKE :search
          OR LOWER(COALESCE(area.name, '')) LIKE :search
        )`,
        { search: `%${search}%` },
      );
    }

    const [requests, total] = await builder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const rawStats = await this.requestRepository
      .createQueryBuilder('request')
      .select('request.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('request.status')
      .getRawMany<{ status: EmploymentCertificateStatus; count: string }>();

    const counts = new Map(rawStats.map((item) => [item.status, Number(item.count)]));
    const stats = {
      pending: counts.get(EmploymentCertificateStatus.PENDING) || 0,
      inProgress: counts.get(EmploymentCertificateStatus.IN_PROGRESS) || 0,
      ready: counts.get(EmploymentCertificateStatus.READY) || 0,
      delivered: counts.get(EmploymentCertificateStatus.DELIVERED) || 0,
      rejected: counts.get(EmploymentCertificateStatus.REJECTED) || 0,
      total: [...counts.values()].reduce((sum, count) => sum + count, 0),
    };

    return {
      data: requests.map((request) => this.formatInboxItem(request)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats,
    };
  }

  async findMine(requesterId: string) {
    const employeeId = await this.resolveEmployeeId(requesterId);
    const requests = await this.requestRepository.find({
      where: { employeeId },
      order: { createdAt: 'DESC' },
    });

    return requests.map((request) => ({
      id: request.id,
      type: request.type,
      typeLabel: EMPLOYMENT_CERTIFICATE_TYPE_LABELS[request.type],
      status: request.status,
      embassyName: request.embassyName,
      appointmentDate: request.appointmentDate,
      observation: request.observation,
      requestedAt: request.createdAt,
      processedAt: request.processedAt,
      readyAt: request.readyAt,
      deliveredAt: request.deliveredAt,
      documentNumber: request.documentNumber,
      generatedAt: request.generatedAt,
    }));
  }

  async generatePdf(id: string, requesterId: string) {
    await this.assertHrAccess(requesterId);
    const request = await this.requestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.employee', 'employee')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :activeStatus',
        { activeStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'position')
      .leftJoinAndSelect('jobRecord.functionalPosition', 'functionalPosition')
      .where('request.id = :id', { id })
      .getOne();

    if (!request) throw new NotFoundException('Solicitud de constancia no encontrada.');
    if (
      request.type === EmploymentCertificateType.EMBASSY &&
      (!request.embassyName?.trim() || !request.appointmentDate)
    ) {
      throw new BadRequestException([
        'La solicitud debe tener la embajada y la fecha de la cita para generar el PDF.',
      ]);
    }
    if (
      ![
        EmploymentCertificateStatus.IN_PROGRESS,
        EmploymentCertificateStatus.READY,
        EmploymentCertificateStatus.DELIVERED,
      ].includes(request.status)
    ) {
      throw new BadRequestException([
        'La solicitud debe estar en preparación, lista o entregada para generar el PDF.',
      ]);
    }
    if (
      ![
        EmploymentCertificateType.WITH_DEDUCTIONS,
        EmploymentCertificateType.WITHOUT_DEDUCTIONS,
        EmploymentCertificateType.BOND,
        EmploymentCertificateType.IHSS_AFFILIATION,
        EmploymentCertificateType.INJUPEMP_AFFILIATION,
        EmploymentCertificateType.EMBASSY,
        EmploymentCertificateType.SIAFI_PIN,
      ].includes(request.type)
    ) {
      throw new BadRequestException(['El formato PDF de este tipo de constancia aún no está configurado.']);
    }

    const processorEmployeeId = await this.resolveEmployeeId(requesterId);
    const activeJob = request.employee.jobRecords?.[0];
    const employeeName = [
      request.employee.firstName,
      request.employee.middleName,
      request.employee.lastName,
      request.employee.secondLastName,
    ].filter(Boolean).join(' ');
    const now = new Date();

    if (!request.documentNumber) {
      request.documentNumber = `CL-${now.getFullYear()}-${request.id.slice(0, 6).toUpperCase()}`;
    }
    let payrollData: any = null;
    if (
      [
        EmploymentCertificateType.WITH_DEDUCTIONS,
        EmploymentCertificateType.INJUPEMP_AFFILIATION,
        EmploymentCertificateType.EMBASSY,
      ].includes(request.type)
    ) {
      payrollData = await this.receiptRepository.findOne({
        where: { employeeId: request.employeeId },
        relations: { items: true },
        order: { year: 'DESC', createdAt: 'DESC' },
      });
      if (
        !payrollData &&
        request.type === EmploymentCertificateType.WITH_DEDUCTIONS
      ) {
        throw new BadRequestException([
          'El empleado no tiene un comprobante de pago importado para obtener sus deducciones.',
        ]);
      }
    }

    request.generatedAt = request.generatedAt || now;
    request.generatedByEmployeeId = request.generatedByEmployeeId || processorEmployeeId;
    await this.requestRepository.save(request);

    const deductions = payrollData?.items
      ?.filter((item: any) =>
        [PayrollItemType.DEDUCTION, PayrollItemType.WITHHOLDING].includes(item.itemType),
      )
      .map((item: any) => ({ description: item.description, amount: Number(item.amount || 0) })) || [];
    const grossSalary = payrollData
      ? Number(payrollData.integralSalary || payrollData.ordinarySalary || activeJob?.salary || 0)
      : Number(activeJob?.salary || 0);
    const totalDeductions = deductions.reduce(
      (total, deduction) => total + Number(deduction.amount || 0),
      0,
    );
    const netSalary = Math.max(grossSalary - totalDeductions, 0);
    const modality =
      activeJob?.modality?.name?.trim().toLocaleLowerCase('es') === 'contrato'
        ? 'Contrato'
        : 'Acuerdo';
    const entryDateValue = new Date(request.employee.entryDate);
    const activeJobStartDate = activeJob?.startDate
      ? new Date(activeJob.startDate)
      : null;
    const hasContractToAgreementTransition =
      modality === 'Acuerdo' &&
      !!activeJobStartDate &&
      !Number.isNaN(entryDateValue.getTime()) &&
      !Number.isNaN(activeJobStartDate.getTime()) &&
      activeJobStartDate.getTime() > entryDateValue.getTime();

    const publicWebUrl = this.configService.get<string>(
      'PUBLIC_WEB_URL',
      'https://sigerh.senasa.gob.hn',
    );
    const docDefinition = await EmploymentCertificateReport({
      type: request.type,
      documentNumber: request.documentNumber,
      employeeName,
      identity: this.formatIdentity(request.employee.dni),
      entryDate: this.formatLongDate(request.employee.entryDate),
      financeEntryDate: this.formatFinanceDate(request.employee.entryDate),
      modality,
      embassyName: request.embassyName,
      appointmentDate: request.appointmentDate
        ? this.formatLongDate(request.appointmentDate)
        : null,
      agreementDate: activeJob?.startDate
        ? this.formatLongDate(activeJob.startDate)
        : null,
      hasContractToAgreementTransition,
      position:
        activeJob?.position?.name || 'No registrado',
      nominalPosition: activeJob?.position?.name || 'No registrado',
      functionalPosition: activeJob?.functionalPosition?.name || 'No registrado',
      financeModality: activeJob?.modality?.name?.trim().toLocaleLowerCase('es-HN') || 'no registrada',
      grossSalary,
      amountInWords: numberToLempirasWords(grossSalary),
      deductions,
      totalDeductions,
      netSalary,
      employerNumber: '101201607261',
      issueDate: this.formatIssueDate(now),
      issueDateInWords: this.formatIssueDateInWords(now),
      signerName: 'ING. KEVIN ERNESTO MENDOZA LIRA',
      signerTitle:
        [
          EmploymentCertificateType.WITH_DEDUCTIONS,
          EmploymentCertificateType.WITHOUT_DEDUCTIONS,
        ].includes(request.type)
          ? 'DIRECTOR DE RECURSOS HUMANOS Y CAPACITACIÓN DEL SENASA'
          :
        [
          EmploymentCertificateType.INJUPEMP_AFFILIATION,
          EmploymentCertificateType.EMBASSY,
          EmploymentCertificateType.SIAFI_PIN,
          EmploymentCertificateType.BOND,
        ].includes(request.type)
          ? 'DIRECTOR DE RECURSOS HUMANOS Y CAPACITACIONES DEL SENASA'
          : 'JEFE DEL DEPARTAMENTO DE PERSONAL POR DELEGACIÓN',
      delegationMemo:
        [
          EmploymentCertificateType.WITH_DEDUCTIONS,
          EmploymentCertificateType.WITHOUT_DEDUCTIONS,
          EmploymentCertificateType.INJUPEMP_AFFILIATION,
          EmploymentCertificateType.EMBASSY,
          EmploymentCertificateType.SIAFI_PIN,
          EmploymentCertificateType.BOND,
        ].includes(request.type)
          ? ''
          : request.type === EmploymentCertificateType.IHSS_AFFILIATION
          ? 'SEGÚN MEMORÁNDUM DGS-DRHC-459-2026'
          : 'SEGÚN MEMORÁNDUM DGS-DRHC-435-2026',
      validationUrl: `${publicWebUrl}/validar-constancia/${request.id}`,
      printedAt: now.toLocaleString('es-HN', { timeZone: 'America/Tegucigalpa' }),
    });

    return {
      pdf: this.printerService.createPdf(docDefinition),
      documentNumber: request.documentNumber,
    };
  }

  async validateDocument(id: string) {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: { employee: true },
    });
    if (!request?.generatedAt || !request.documentNumber) {
      throw new NotFoundException('Constancia no encontrada o todavía no emitida.');
    }
    return {
      valid: true,
      documentNumber: request.documentNumber,
      type: request.type,
      typeLabel: EMPLOYMENT_CERTIFICATE_TYPE_LABELS[request.type],
      employeeName: [
        request.employee.firstName,
        request.employee.middleName,
        request.employee.lastName,
        request.employee.secondLastName,
      ].filter(Boolean).join(' '),
      generatedAt: request.generatedAt,
      status: request.status,
    };
  }

  async updateStatus(
    id: string,
    requesterId: string,
    dto: UpdateEmploymentCertificateStatusDto,
  ) {
    await this.assertHrAccess(requesterId);
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: { employee: true },
    });
    if (!request) throw new NotFoundException('Solicitud de constancia no encontrada.');

    this.validateTransition(request.status, dto.status);
    if (
      dto.status === EmploymentCertificateStatus.READY &&
      [
        EmploymentCertificateType.WITH_DEDUCTIONS,
        EmploymentCertificateType.WITHOUT_DEDUCTIONS,
        EmploymentCertificateType.BOND,
        EmploymentCertificateType.IHSS_AFFILIATION,
        EmploymentCertificateType.INJUPEMP_AFFILIATION,
        EmploymentCertificateType.EMBASSY,
        EmploymentCertificateType.SIAFI_PIN,
      ].includes(request.type) &&
      !request.generatedAt
    ) {
      throw new BadRequestException([
        'Debes generar la constancia PDF antes de marcarla como lista.',
      ]);
    }
    const processorEmployeeId = await this.resolveEmployeeId(requesterId);
    const now = new Date();

    request.status = dto.status;
    request.observation = dto.observation?.trim() || request.observation;
    request.processedByEmployeeId = processorEmployeeId;
    request.processedAt = request.processedAt || now;

    if (dto.status === EmploymentCertificateStatus.READY) request.readyAt = now;
    if (dto.status === EmploymentCertificateStatus.DELIVERED) request.deliveredAt = now;

    const saved = await this.requestRepository.save(request);

    if (dto.status === EmploymentCertificateStatus.DELIVERED) {
      const employeeName = [
        request.employee?.firstName,
        request.employee?.middleName,
        request.employee?.lastName,
        request.employee?.secondLastName,
      ].filter(Boolean).join(' ') || 'Empleado';
      const generatedDocument = await this.generatePdf(id, requesterId);
      const pdfBuffer = await this.pdfStreamToBuffer(generatedDocument.pdf);
      await sendRequestNotification(
        request.employee?.email,
        'Tu constancia laboral fue entregada',
        employeeName,
        'Tu constancia laboral fue marcada como entregada por Recursos Humanos. Encontrarás el documento PDF adjunto en este correo.',
        [
          `Tipo: ${EMPLOYMENT_CERTIFICATE_TYPE_LABELS[request.type]}`,
          request.documentNumber ? `Documento: ${request.documentNumber}` : '',
        ].filter(Boolean),
        undefined,
        [
          {
            filename: `constancia-${generatedDocument.documentNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      );
    }

    return saved;
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

  private validateTransition(
    current: EmploymentCertificateStatus,
    next: EmploymentCertificateStatus,
  ) {
    const allowed: Record<EmploymentCertificateStatus, EmploymentCertificateStatus[]> = {
      [EmploymentCertificateStatus.PENDING]: [
        EmploymentCertificateStatus.IN_PROGRESS,
        EmploymentCertificateStatus.REJECTED,
      ],
      [EmploymentCertificateStatus.IN_PROGRESS]: [
        EmploymentCertificateStatus.READY,
        EmploymentCertificateStatus.REJECTED,
      ],
      [EmploymentCertificateStatus.READY]: [EmploymentCertificateStatus.DELIVERED],
      [EmploymentCertificateStatus.DELIVERED]: [],
      [EmploymentCertificateStatus.REJECTED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException([
        `No se puede cambiar una solicitud de ${current} a ${next}.`,
      ]);
    }
  }

  private async resolveEmployeeId(requesterId: string) {
    const user = await this.userRepository.findOne({
      where: { id: requesterId },
      select: { id: true, employeeId: true },
    });

    if (!user?.employeeId) {
      throw new NotFoundException('No se encontró el empleado asociado al usuario autenticado.');
    }

    return user.employeeId;
  }

  private async assertHrAccess(requesterId: string) {
    const count = await this.roleUserRepository
      .createQueryBuilder('permission')
      .innerJoin('permission.components', 'component')
      .where('permission.user_id = :requesterId', { requesterId })
      .andWhere('component.description = :description', {
        description: 'Constancias Laborales',
      })
      .getCount();

    if (!count) {
      throw new ForbiddenException(
        'No tienes permiso para administrar solicitudes de constancias.',
      );
    }
  }

  private formatIdentity(value: string) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 13
      ? `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`
      : value;
  }

  private formatLongDate(value: Date | string) {
    const dateOnly =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value).trim().slice(0, 10);
    const date = new Date(`${dateOnly}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(['La fecha laboral registrada no es válida.']);
    }

    return new Intl.DateTimeFormat('es-HN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Tegucigalpa',
    }).format(date);
  }

  private formatIssueDate(value: Date) {
    return `a los ${value.getDate()} días del mes de ${new Intl.DateTimeFormat('es-HN', {
      month: 'long', timeZone: 'America/Tegucigalpa',
    }).format(value)} del año ${value.getFullYear()}`;
  }

  private formatFinanceDate(value: Date | string) {
    const longDate = this.formatLongDate(value);
    const [day, ...rest] = longDate.split(' de ');
    return `${day.padStart(2, '0')} de ${rest.join(' del ')}`;
  }

  private formatIssueDateInWords(value: Date) {
    const day = numberToSpanishWords(value.getDate()).toLocaleLowerCase('es-HN');
    const year = numberToSpanishWords(value.getFullYear()).toLocaleLowerCase('es-HN');
    const month = new Intl.DateTimeFormat('es-HN', {
      month: 'long',
      timeZone: 'America/Tegucigalpa',
    }).format(value);

    return `${day} días del mes de ${month} del año ${year}`;
  }

  private formatInboxItem(request: EmploymentCertificateRequest) {
    const employee = request.employee;
    const activeRecord = employee.jobRecords?.find(
      (record) => String(record.status || '').toLowerCase() === 'active',
    );
    const fullName = [
      employee.firstName,
      employee.middleName,
      employee.lastName,
      employee.secondLastName,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: request.id,
      employeeId: employee.id,
      employeeCode: employee.biometric_id
        ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
        : `EMP-${employee.id.slice(0, 4).toUpperCase()}`,
      employeeName: fullName,
      employeeInitials: [employee.firstName, employee.lastName]
        .filter(Boolean)
        .map((value) => value.charAt(0).toUpperCase())
        .join(''),
      dni: employee.dni,
      departmentName: activeRecord?.area?.name || 'Sin departamento',
      type: request.type,
      typeLabel: EMPLOYMENT_CERTIFICATE_TYPE_LABELS[request.type],
      status: request.status,
      embassyName: request.embassyName,
      appointmentDate: request.appointmentDate,
      observation: request.observation,
      requestedAt: request.createdAt,
      processedAt: request.processedAt,
      readyAt: request.readyAt,
      deliveredAt: request.deliveredAt,
      documentNumber: request.documentNumber,
      generatedAt: request.generatedAt,
    };
  }
}
