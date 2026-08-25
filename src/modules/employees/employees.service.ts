import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { DataSource } from 'typeorm/data-source/index.js';
import { EntityManager, Repository } from 'typeorm';
import { RnpService } from 'src/common/rnp/rnp.service';
import { RnpServices } from '../rnp/rnp.service';
import { AcademicHistoryService } from '../academic-history/academic-history.service';
import { DocumentDto } from './dtos/create-employees.dto';
import { EmployeeDocument } from './entities/employee-document.entity';
import { StorageService } from 'src/common/services/storage.service';
import { randomUUID } from 'crypto';
import { EmployeeJobRecordService } from '../employee-job-record/employee-job-record.service';
import { EmployeeEmergencyContact } from './entities/emergency_contacts.interface';
import { Brackets } from 'typeorm';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';
import { UsersService } from '../users/users.service';
import { sendNewEmployee } from 'src/common/helpers/send-email.helper';
import {
  EmployeeIntakeRequest,
  PublicIntakeGeneralDocumentRecord,
} from '../employee-intake/entities/employee-intake.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { UpdateEmployeeEditableDto } from './dtos/update-employee-editable.dto';
import * as path from 'path';
import * as fs from 'fs';
import {
  parseDateOnly,
  serializeDateOnly,
} from 'src/common/utils/date-only.util';
import { EmployeeUnpaidLeave } from './entities/employee-unpaid-leave.entity';
import { User } from '../users/entities/user.entity';
import { AcademicHistory } from '../academic-history/entities/academic-history.entity';
import { OrganizationalUnit } from '../department/entities/organizational-unit.entity';
import { ApprovalRoutingService } from '../area-manager/approval-routing.service';
import { PublicCriminalRecordUpdateDto } from './dtos/public-criminal-record.dto';
import { WatchUsersService } from '../watch-users/watch-users.service';
import { ResetEmployeePasswordDto } from './dtos/reset-employee-password.dto';
interface FindAllEmployeesParams {
  search?: string;
  departmentId?: string;
  status?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Employee)
    private _employee: Repository<Employee>,
    @InjectRepository(EmployeeJobRecord)
    private readonly employeeJobRecordRepository: Repository<EmployeeJobRecord>,
    @InjectRepository(EmployeeDocument)
    private _EmployeeDocument: Repository<EmployeeDocument>,
    private _rnpService: RnpService,
    private _RnpService: RnpServices,
    private readonly academicHistoryService: AcademicHistoryService,
    private readonly storageService: StorageService,
    private readonly employeeJobRecordService: EmployeeJobRecordService,
    private readonly employeeVacationPeriodService: EmployeeVacationPeriodService,
    private readonly _usersService: UsersService,
    private readonly watchUsersService: WatchUsersService,
    private readonly approvalRoutingService: ApprovalRoutingService,
  ) {}

  getEmployeeAccount(employeeId: string) {
    return this._usersService.getAccountByEmployeeId(employeeId);
  }

  resetEmployeePassword(employeeId: string, dto: ResetEmployeePasswordDto) {
    return this._usersService.resetPasswordByEmployeeId(
      employeeId,
      dto.password,
      dto.mustChangePassword !== false,
    );
  }

  async initializeBiometricIdSequence() {
    await this.dataSource.query(`
      CREATE SEQUENCE IF NOT EXISTS employees_biometric_id_seq START WITH 1 INCREMENT BY 1;
      DO $$
      DECLARE
        maximum_id bigint;
      BEGIN
        SELECT MAX(biometric_id::bigint)
          INTO maximum_id
          FROM employees
         WHERE biometric_id ~ '^[0-9]+$';

        IF maximum_id IS NULL THEN
          PERFORM setval('employees_biometric_id_seq', 1, false);
        ELSE
          PERFORM setval('employees_biometric_id_seq', maximum_id, true);
        END IF;
      END $$;

      ALTER TABLE employees
        ALTER COLUMN biometric_id
        SET DEFAULT nextval('employees_biometric_id_seq')::text;

      UPDATE employees
         SET biometric_id = nextval('employees_biometric_id_seq')::text
       WHERE biometric_id IS NULL
          OR BTRIM(biometric_id) = '';
    `);
  }

  async getPublicCriminalRecordStatus(dni: string) {
    this.validatePublicDni(dni);
    const employee = await this._employee
      .createQueryBuilder('employee')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :activeStatus',
        { activeStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('jobRecord.functionalPosition', 'functionalPosition')
      .leftJoinAndSelect('jobRecord.position', 'position')
      .where('employee.dni = :dni', { dni })
      .getOne();

    if (!employee)
      throw new NotFoundException(
        'No se encontró un empleado con esa identidad.',
      );

    const currentDocument = await this._EmployeeDocument.findOne({
      where: {
        employeeId: employee.id,
        documentType: 'criminal_record',
        isActive: true,
      },
      order: { created_at: 'DESC' },
    });
    const documentStatus = this.getCriminalRecordStatus(
      currentDocument?.expirationDate ?? null,
    );
    const job = employee.jobRecords?.[0];

    return {
      employee: {
        fullName: [
          employee.firstName,
          employee.middleName,
          employee.lastName,
          employee.secondLastName,
        ]
          .filter(Boolean)
          .join(' '),
        employeeCode: employee.biometric_id
          ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
          : `EMP-${employee.id.slice(0, 4).toUpperCase()}`,
        dni: employee.dni,
        employmentStatus: String(employee.status || '').toUpperCase(),
        departmentName: job?.area?.name || null,
        positionName:
          job?.functionalPosition?.name || job?.position?.name || null,
      },
      criminalRecord: {
        expirationDate: currentDocument?.expirationDate ?? null,
        ...documentStatus,
      },
    };
  }

  async updatePublicCriminalRecord(
    dni: string,
    dto: PublicCriminalRecordUpdateDto,
  ) {
    this.validatePublicDni(dni);
    const status = await this.getPublicCriminalRecordStatus(dni);
    if (!status.criminalRecord.canUpdate) {
      throw new BadRequestException(
        'Los antecedentes solo pueden actualizarse cuando faltan 30 días o menos para vencer.',
      );
    }

    const employee = await this._employee.findOne({ where: { dni } });
    if (!employee) throw new NotFoundException('Empleado no encontrado.');

    const base64Payload = dto.base64.replace(
      /^data:application\/pdf;base64,/i,
      '',
    );
    const buffer = Buffer.from(base64Payload, 'base64');
    if (
      !buffer.length ||
      buffer.length > 10 * 1024 * 1024 ||
      buffer.subarray(0, 4).toString() !== '%PDF'
    ) {
      throw new BadRequestException(
        'El PDF no es válido o supera el máximo de 10 MB.',
      );
    }

    const expirationDate = new Date(
      `${dto.expirationDate.slice(0, 10)}T00:00:00.000Z`,
    );
    if (
      Number.isNaN(expirationDate.getTime()) ||
      expirationDate <= new Date()
    ) {
      throw new BadRequestException(
        'La nueva fecha de vencimiento debe ser futura.',
      );
    }

    const fileName = `${randomUUID()}.pdf`;
    const filePath = this.storageService.saveBase64File(
      dto.base64,
      `employees/${employee.id}`,
      fileName,
    );

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.update(
          EmployeeDocument,
          {
            employeeId: employee.id,
            documentType: 'criminal_record',
            isActive: true,
          },
          { isActive: false },
        );
        await manager.save(
          manager.create(EmployeeDocument, {
            employeeId: employee.id,
            documentType: 'criminal_record',
            fileName,
            originalName: dto.originalName,
            extension: 'pdf',
            mimeType: 'application/pdf',
            fileSize: buffer.length,
            filePath,
            isActive: true,
            isPrivate: true,
            expirationDate,
            notes: 'Actualizado por el empleado desde la consulta pública.',
          }),
        );
      });
    } catch (error) {
      this.storageService.deleteFile(filePath);
      throw error;
    }

    return {
      message: 'Antecedentes penales actualizados correctamente.',
      expirationDate: dto.expirationDate.slice(0, 10),
    };
  }

  private validatePublicDni(dni: string) {
    if (!/^\d{13}$/.test(dni)) {
      throw new BadRequestException('La identidad debe contener 13 dígitos.');
    }
  }

  private getCriminalRecordStatus(expirationDate: Date | null) {
    if (!expirationDate) {
      return {
        status: 'missing',
        label: 'Documento pendiente',
        daysRemaining: null,
        canUpdate: true,
      };
    }
    const today = new Date();
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const expiration = new Date(expirationDate);
    const expirationUtc = Date.UTC(
      expiration.getUTCFullYear(),
      expiration.getUTCMonth(),
      expiration.getUTCDate(),
    );
    const daysRemaining = Math.ceil((expirationUtc - todayUtc) / 86_400_000);
    if (daysRemaining < 0)
      return {
        status: 'expired',
        label: 'Documento vencido',
        daysRemaining,
        canUpdate: true,
      };
    if (daysRemaining <= 30)
      return {
        status: 'expiring',
        label: 'Próximo a vencer',
        daysRemaining,
        canUpdate: true,
      };
    return {
      status: 'current',
      label: 'Documento vigente',
      daysRemaining,
      canUpdate: false,
    };
  }

  async findAll(params: FindAllEmployeesParams) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 9, 1), 50);

    const query = this._employee
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('area.unitType', 'areaUnitType')
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      );

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where(`LOWER(employee.dni) LIKE :search`, { search });
          qb.orWhere(
            `LOWER(COALESCE(employee.biometric_id, '')) LIKE :search`,
            {
              search,
            },
          );
          qb.orWhere(`LOWER(employee.firstName) LIKE :search`, { search });
          qb.orWhere(`LOWER(COALESCE(employee.middleName, '')) LIKE :search`, {
            search,
          });
          qb.orWhere(`LOWER(employee.lastName) LIKE :search`, { search });
          qb.orWhere(
            `LOWER(COALESCE(employee.secondLastName, '')) LIKE :search`,
            {
              search,
            },
          );
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
          qb.orWhere(`LOWER(COALESCE(position.name, '')) LIKE :search`, {
            search,
          });
          qb.orWhere(
            `LOWER(COALESCE(jobRecordPosition.name, '')) LIKE :search`,
            {
              search,
            },
          );
          qb.orWhere(
            `LOWER(COALESCE(jobRecordFunctionalPosition.name, '')) LIKE :search`,
            {
              search,
            },
          );
        }),
      );
    }

    if (params.departmentId?.trim()) {
      query.andWhere('area.id = :departmentId', {
        departmentId: params.departmentId.trim(),
      });
    }

    if (params.status?.trim()) {
      query.andWhere('LOWER(employee.status) = :status', {
        status: params.status.trim().toLowerCase(),
      });
    }

    query.orderBy('employee.created_at', 'DESC');

    const [employees, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: employees.map((employee, index) => {
        const currentRecord = employee.jobRecords?.find(
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
          id: employee.id,
          code: `EMP-${String((page - 1) * limit + index + 1).padStart(4, '0')}`,
          dni: employee.dni,
          firstName: employee.firstName,
          middleName: employee.middleName,
          lastName: employee.lastName,
          secondLastName: employee.secondLastName,
          fullName,
          positionName:
            currentRecord?.functionalPosition?.name ||
            currentRecord?.position?.name ||
            null,
          functionalPositionName:
            currentRecord?.functionalPosition?.name || null,
          nominalPositionName: currentRecord?.position?.name || null,
          departmentName: currentRecord?.area?.name || null,
          departmentId: currentRecord?.area?.id || null,
          regionalId: employee.regional_id || null,
          status: String(employee.status || '').toUpperCase(),
          entryDate: serializeDateOnly(employee.entryDate),
          salary:
            currentRecord?.salary !== null &&
            currentRecord?.salary !== undefined
              ? Number(currentRecord.salary)
              : null,
          modalityName: currentRecord?.modality?.name || null,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const employee = await this._employee
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.position', 'position')
      .leftJoinAndSelect('employee.regional', 'regional')
      .leftJoinAndSelect('employee.schedule', 'schedule')
      .leftJoinAndSelect('employee.emergencyContact', 'emergencyContact')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('area.unitType', 'detailAreaUnitType')
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )
      .leftJoinAndSelect('employee.documents', 'document')
      .leftJoinAndSelect('employee.unpaidLeaves', 'unpaidLeave')
      .where('employee.id = :id', { id })
      .orderBy('document.created_at', 'DESC')
      .getOne();

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado.');
    }

    const currentRecord = employee.jobRecords
      ?.filter(
        (record) => String(record.status || '').toLowerCase() === 'active',
      )
      .sort((left, right) => {
        const currentDifference = Number(Boolean(right.isCurrent)) - Number(Boolean(left.isCurrent));
        if (currentDifference) return currentDifference;
        return new Date(right.startDate || 0).getTime() - new Date(left.startDate || 0).getTime();
      })[0];
    const directBoss = currentRecord?.area?.id && employee.regional_id
      ? await this.approvalRoutingService
          .resolveAreaOrMainManager(
            employee.id,
            currentRecord.area.id,
            employee.regional_id,
          )
          .catch(() => null)
      : null;
    const directBossName = directBoss?.employee
      ? [
          directBoss.employee.firstName,
          directBoss.employee.middleName,
          directBoss.employee.lastName,
          directBoss.employee.secondLastName,
        ]
          .filter(Boolean)
          .join(' ')
      : null;

    const fullName = [
      employee.firstName,
      employee.middleName,
      employee.lastName,
      employee.secondLastName,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: employee.id,
      employeeCode: employee.biometric_id
        ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
        : `EMP-${employee.id.slice(0, 4).toUpperCase()}`,
      dni: employee.dni,
      rtn: employee.rtn,
      fullName,
      firstName: employee.firstName,
      middleName: employee.middleName,
      lastName: employee.lastName,
      secondLastName: employee.secondLastName,
      email: employee.email,
      phone: employee.phone,
      status: String(employee.status || '').toUpperCase(),
      birthDate: serializeDateOnly(employee.birth_date),
      birthPlace: employee.birth_place,
      address: employee.address,
      entryDate: serializeDateOnly(employee.entryDate),
      gender: employee.gender,
      maritalStatus: employee.marital_status,
      bloodType: employee.type_blood,
      biometricId: employee.biometric_id,
      profilePhotoUrl: employee.profile_photo_path
        ? `/employees/${employee.id}/profile-photo?v=${
            employee.updated_at
              ? new Date(employee.updated_at).getTime()
              : Date.now()
          }`
        : null,
      regionalName: employee.regional?.name || null,
      regionalAddress: employee.regional?.address || null,
      scheduleDescription: employee.schedule?.description || null,
      scheduleStartTime: employee.schedule?.startTime || null,
      scheduleEndTime: employee.schedule?.endTime || null,
      modalityName: currentRecord?.modality?.name || null,
      functionalPositionName: currentRecord?.functionalPosition?.name || null,
      nominalPositionName: currentRecord?.position?.name || null,
      departmentName: currentRecord?.area?.name || null,
      departmentId: currentRecord?.area?.id || null,
      organizationalTypeId: currentRecord?.area?.unitType?.id || null,
      organizationalTypeName: currentRecord?.area?.unitType?.name || null,
      directBossName,
      directBossEmployeeId: directBoss?.employeeId || null,
      directBossScope: directBoss?.scope || null,
      salary:
        currentRecord?.salary !== null && currentRecord?.salary !== undefined
          ? Number(currentRecord.salary)
          : null,
      emergencyContact: employee.emergencyContact
        ? {
            name: employee.emergencyContact.emergency_contact_name,
            relationship:
              employee.emergencyContact.emergency_contact_relationship,
            phone: employee.emergencyContact.emergency_contact_phone,
          }
        : null,
      documents:
        employee.documents?.map((document) => ({
          id: document.id,
          documentType: document.documentType,
          originalName: document.originalName,
          extension: document.extension,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          filePath: document.filePath,
          isActive: document.isActive,
          expirationDate: serializeDateOnly(document.expirationDate),
          notes: document.notes,
        })) || [],
      unpaidLeaves:
        employee.unpaidLeaves?.map((leave) => ({
          id: leave.id,
          startDate: serializeDateOnly(leave.startDate),
          endDate: serializeDateOnly(leave.endDate),
          days: leave.days,
          observation: leave.observation,
        })) || [],
    };
  }

  async updateEditableData(id: string, dto: UpdateEmployeeEditableDto) {
    const qr = this.dataSource.createQueryRunner();
    let newProfilePhotoPath: string | null = null;
    let previousProfilePhotoPath: string | null = null;

    await qr.connect();
    await qr.startTransaction();

    try {
      const employee = await qr.manager.findOne(Employee, {
        where: { id },
      });

      if (!employee) {
        throw new NotFoundException('Empleado no encontrado.');
      }

      const activeJobRecord = await qr.manager
        .createQueryBuilder(EmployeeJobRecord, 'record')
        .where('record.employeeId = :employeeId', { employeeId: id })
        .andWhere('LOWER(record.status) = :status', { status: 'active' })
        .orderBy('record.created_at', 'DESC')
        .getOne();

      if (!activeJobRecord) {
        throw new BadRequestException([
          'El empleado no tiene un registro laboral activo para actualizar.',
        ]);
      }

      if (dto.email !== undefined) {
        (employee as any).email = dto.email?.trim() || null;
      }

      if (dto.marital_status !== undefined) {
        (employee as any).marital_status = dto.marital_status?.trim() || null;
      }

      if (dto.address !== undefined) {
        (employee as any).address = dto.address?.trim() || null;
      }

      if (dto.phone !== undefined) {
        (employee as any).phone = dto.phone?.trim() || null;
      }

      if (dto.biometric_id !== undefined) {
        (employee as any).biometric_id = dto.biometric_id?.trim() || null;
      }

      if (dto.profile_photo_base64) {
        this.validateProfilePhoto(dto.profile_photo_base64);
        previousProfilePhotoPath = employee.profile_photo_path;
        newProfilePhotoPath = this.storageService.saveBase64File(
          dto.profile_photo_base64,
          `employees/${employee.id}`,
          `${randomUUID()}photo.png`,
        );
        employee.profile_photo_path = newProfilePhotoPath;
      }

      if (dto.nominal_position !== undefined) {
        activeJobRecord.nominal_position = dto.nominal_position || null;
        (employee as any).position_id = dto.nominal_position || null;
      }

      if (dto.functional_position !== undefined) {
        activeJobRecord.functional_position = dto.functional_position || null;
      }

      if (dto.organizational_type !== undefined || dto.area_id !== undefined) {
        if (!dto.organizational_type || !dto.area_id) {
          throw new BadRequestException([
            'Debes seleccionar el tipo y la unidad organizacional.',
          ]);
        }

        const organizationalUnit = await qr.manager.findOne(
          OrganizationalUnit,
          {
            where: {
              id: dto.area_id,
              unit_type: dto.organizational_type,
              is_active: true,
            },
          },
        );

        if (!organizationalUnit) {
          throw new BadRequestException([
            'La unidad organizacional seleccionada no pertenece al tipo indicado o está inactiva.',
          ]);
        }

        activeJobRecord.area_id = organizationalUnit.id;
      }

      if (dto.salary !== undefined) {
        (activeJobRecord as any).salary =
          dto.salary !== null ? Number(dto.salary) : null;
      }

      await qr.manager.save(Employee, employee);
      await qr.manager.save(EmployeeJobRecord, activeJobRecord);
      await qr.commitTransaction();

      if (
        previousProfilePhotoPath &&
        previousProfilePhotoPath !== newProfilePhotoPath
      ) {
        this.storageService.deleteFile(previousProfilePhotoPath);
      }

      return this.findOne(id);
    } catch (error) {
      await qr.rollbackTransaction();

      if (newProfilePhotoPath) {
        this.storageService.deleteFile(newProfilePhotoPath);
      }

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new InternalServerErrorException([
        'Error al actualizar la información editable del empleado.',
      ]);
    } finally {
      await qr.release();
    }

  }

  async getProfilePhoto(id: string) {
    const employee = await this._employee.findOne({
      where: { id },
      select: ['id', 'profile_photo_path'],
    });

    if (!employee?.profile_photo_path) {
      throw new NotFoundException('El empleado no tiene foto de perfil.');
    }

    const absolutePath = this.storageService.getAbsolutePath(
      employee.profile_photo_path,
    );

    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('La foto de perfil no está disponible.');
    }

    return absolutePath;
  }

  private validateProfilePhoto(base64: string) {
    const match = base64.match(/^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/);

    if (!match) {
      throw new BadRequestException([
        'La foto de perfil debe enviarse como una imagen PNG válida.',
      ]);
    }

    const buffer = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
    const pngSignature = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);

    if (
      !buffer.length ||
      buffer.length > 2 * 1024 * 1024 ||
      !buffer.subarray(0, 8).equals(pngSignature)
    ) {
      throw new BadRequestException([
        'La foto de perfil no es un PNG válido o supera el límite de 2 MB.',
      ]);
    }
  }

  async create(dto: any, user: any) {
    const filesToConvertAfterCommit: {
      documentId: string;
      filePath: string;
      folder: string;
      fileName: string;
    }[] = [];
    let savedEmployee: Employee | null = null;

    const qr = this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();
    const writtenFiles: string[] = [];
    let intakeRequest: EmployeeIntakeRequest | null = null;

    try {
      if (dto.intake_request_id) {
        intakeRequest = await qr.manager.findOne(EmployeeIntakeRequest, {
          where: { id: dto.intake_request_id },
        });

        if (!intakeRequest) {
          throw new BadRequestException([
            'La solicitud temporal no fue encontrada.',
          ]);
        }

        if (intakeRequest.status === 'CONVERTED') {
          throw new BadRequestException([
            'Esta solicitud temporal ya fue convertida.',
          ]);
        }

        if (intakeRequest.status !== 'REVIEWED') {
          throw new BadRequestException([
            'La solicitud temporal debe estar revisada antes de convertirla en empleado.',
          ]);
        }
      }

      const intakeAcademicHistory = dto.academicHistory?.length
        ? dto.academicHistory
        : intakeRequest?.academic_history || [];
      const hasManualGeneralDocuments = dto.documents?.some(
        (doc) => doc.documentTypeKey === 'general',
      );
      const intakeGeneralDocuments =
        !hasManualGeneralDocuments && intakeRequest?.general_documents?.length
          ? intakeRequest.general_documents
          : [];

      //! ////////////////////////////////////////////////////////////////////////////
      //!Verificamos que no exista otro empleado con el mismo dni ////////////////////
      const existsDni = await qr.manager.findOne(Employee, {
        where: { dni: dto.dni },
      });

      if (existsDni) {
        throw new BadRequestException([
          'Ya existe un empleado registrado con este DNI.',
        ]);
      }

      //! ////////////////////////////////////////////////////////////////////////////
      //!creamos el insert del empleado y lo guardamos en una variable para usar su id;
      const [generatedBiometric] = await qr.manager.query(
        `SELECT nextval('employees_biometric_id_seq')::text AS biometric_id`,
      );
      const employee = qr.manager.create(Employee, {
        dni: dto.dni,
        rtn:
          this.normalizeOptionalString(dto.rtn) || intakeRequest?.rtn || null,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        secondLastName: dto.secondLastName,
        gender: dto.gender,
        marital_status:
          dto.marital_status || intakeRequest?.marital_status || null,
        type_blood: dto.type_blood || intakeRequest?.blood_type || null,
        birth_date: parseDateOnly(dto.birth_date),
        birth_place: dto.birth_place || intakeRequest?.birth_place || null,
        address: dto.address || intakeRequest?.home_address || null,
        entryDate: parseDateOnly(dto.start_date) || new Date(),
        schedule_id: dto.schedule_id,
        regional_id: dto.regional_id,
        status: dto.status ? String(dto.status).toUpperCase() : 'ACTIVE',
        email: dto.email || intakeRequest?.email || null,
        phone: dto.phone || intakeRequest?.phone || null,
        position_id: dto.position_id,
        biometric_id: generatedBiometric.biometric_id,
      });

      savedEmployee = await qr.manager.save(Employee, employee);

      //! ///////////////////////////////////////////////////////////////////////////////////////////
      //!creamos el insert del contacto de emergencia usando el id del empleado que acabamos de crear
      const resolvedEmergencyContactName =
        dto.emergency_contact_name ||
        intakeRequest?.emergency_contact_name ||
        null;
      const resolvedEmergencyContactRelationship =
        dto.emergency_contact_relationship ||
        intakeRequest?.emergency_contact_relationship ||
        null;
      const resolvedEmergencyContactPhone =
        dto.emergency_contact_phone ||
        intakeRequest?.emergency_contact_phone ||
        null;

      if (
        resolvedEmergencyContactName &&
        resolvedEmergencyContactRelationship &&
        resolvedEmergencyContactPhone
      ) {
        const employeeEmergencyContact = qr.manager.create(
          EmployeeEmergencyContact,
          {
            employeeId: savedEmployee.id,
            emergency_contact_name: resolvedEmergencyContactName,
            emergency_contact_relationship:
              resolvedEmergencyContactRelationship,
            emergency_contact_phone: resolvedEmergencyContactPhone,
          },
        );
        await qr.manager.save(
          EmployeeEmergencyContact,
          employeeEmergencyContact,
        );
      }

      //! //////////////////////////////////////////////////////////////////////////////////////////
      //! creamos el insert de la historia academica usando el id del empleado que acabamos de crear
      if (intakeAcademicHistory?.length) {
        await this.academicHistoryService.createMany(
          savedEmployee.id,
          intakeAcademicHistory as any,
          qr.manager,
        );
      }

      //! ///////////////////////////////////////////////////////////////////////////////////////////////////////////
      //! creamos el insert para el servicio de registro del empleado usando el id del empleado que acabamos de crear
      const savedJobRecord =
        await this.employeeJobRecordService.createInitialRecord(
          savedEmployee.id,
          dto,
          qr.manager,
        );

      if (dto.vacation_periods?.length) {
        await this.employeeVacationPeriodService.bootstrapWithManager(
          {
            employee_id: savedEmployee.id,
            employee_job_record_id: savedJobRecord.id,
            periods: dto.vacation_periods,
          },
          qr.manager,
        );
      }

      if (dto.unpaid_leaves?.length) {
        for (const leave of dto.unpaid_leaves) {
          const startDate = parseDateOnly(leave.start_date);
          const endDate = parseDateOnly(leave.end_date);

          if (!startDate || !endDate) {
            throw new BadRequestException(
              'Las fechas de permiso sin goce no tienen un formato válido.',
            );
          }

          await qr.manager.insert(EmployeeUnpaidLeave, {
            employeeId: savedEmployee.id,
            startDate,
            endDate,
            days: Number(leave.days || 0),
            observation: leave.observation?.trim() || null,
          });
        }
      }

      //! //////////////////////////////////////////////////////////////////////////////////////////
      //! creamos el insert de los documentos usando el id del empleado que acabamos de crear//////
      if (dto.documents?.length) {
        for (const doc of dto.documents) {
          const fileName = `${randomUUID()}.${doc.extension}`;
          const folder = `employees/${savedEmployee.id}`;
          const filePath = this.storageService.saveBase64File(
            doc.base64,
            folder,
            fileName,
          );

          writtenFiles.push(filePath);

          await qr.manager.insert(EmployeeDocument, {
            employeeId: savedEmployee.id,
            documentType: doc.documentTypeKey,
            fileName,
            originalName: doc.originalName,
            extension: doc.extension,
            mimeType: doc.mimeType,
            fileSize: doc.size,
            filePath,
            expirationDate: parseDateOnly(doc.expirationDate),
            notes: doc.notes,
            isActive: true,
            isPrivate: false,
          });
        }
      }

      if (intakeGeneralDocuments?.length) {
        await this.copyIntakeGeneralDocuments(
          savedEmployee.id,
          intakeGeneralDocuments,
          qr.manager,
          writtenFiles,
          filesToConvertAfterCommit,
        );
      }

      if (
        intakeRequest?.cv_file_path &&
        !dto.documents?.some((doc) => doc.documentTypeKey === 'cv')
      ) {
        const extension = (intakeRequest.cv_extension || 'pdf').replace(
          '.',
          '',
        );
        const fileName = `${randomUUID()}.${extension}`;
        const folder = `employees/${savedEmployee.id}`;

        const filePath = this.storageService.copyStoredFile(
          intakeRequest.cv_file_path,
          folder,
          fileName,
        );

        writtenFiles.push(filePath);

        const document = qr.manager.create(EmployeeDocument, {
          employeeId: savedEmployee.id,
          documentType: 'cv',
          fileName,
          originalName:
            intakeRequest.cv_original_name ||
            `CV-${savedEmployee.dni}.${extension}`,
          extension,
          mimeType: intakeRequest.cv_mime_type || 'application/octet-stream',
          fileSize: undefined,
          filePath,
          expirationDate: null,
          notes: 'Documento importado desde solicitud temporal',
          isActive: true,
          isPrivate: false,
        });

        const savedDocument = await qr.manager.save(EmployeeDocument, document);

        if (extension === 'doc' || extension === 'docx') {
          filesToConvertAfterCommit.push({
            documentId: savedDocument.id,
            filePath,
            folder,
            fileName,
          });
        }
      }

      if (
        intakeRequest?.criminal_record_file_path &&
        !dto.documents?.some((doc) => doc.documentTypeKey === 'criminal_record')
      ) {
        const extension = intakeRequest.criminal_record_extension || 'pdf';
        const fileName = `${randomUUID()}.${extension}`;
        const folder = `employees/${savedEmployee.id}`;
        const filePath = this.storageService.copyStoredFile(
          intakeRequest.criminal_record_file_path,
          folder,
          fileName,
        );

        writtenFiles.push(filePath);

        await qr.manager.insert(EmployeeDocument, {
          employeeId: savedEmployee.id,
          documentType: 'criminal_record',
          fileName,
          originalName:
            intakeRequest.criminal_record_original_name ||
            `Antecedentes-${savedEmployee.dni}.${extension}`,
          extension,
          mimeType:
            intakeRequest.criminal_record_mime_type ||
            'application/octet-stream',
          fileSize: undefined,
          filePath,
          expirationDate: parseDateOnly(
            intakeRequest.criminal_record_expiration_date,
          ),
          notes: 'Documento importado desde solicitud temporal',
          isActive: true,
          isPrivate: false,
        });
      }

      //! ////////////////////////////////////////////////////////////////////////////
      //!creamos el insert para crear el usuario asociado al empleado con rol estándar;
      const createdUser = await this._usersService.createUser(
        {
          employeeId: savedEmployee.id,
          email: dto.email,
          password: 'temporalsenasa2026',
          firstName: dto.firstName,
          lastName: dto.lastName,
          secondLastName: dto.secondLastName,
        },
        qr.manager,
      );

      await sendNewEmployee(
        dto.email || intakeRequest?.email || '',
        `${dto.firstName} ${dto.lastName} bienvenido al Portal del Empleado`,
        createdUser.username,
        `${dto.firstName} ${dto.middleName}, ${dto.lastName}`,
        'temporalsenasa2026',
        'https://play.google.com/store/apps/details?id=hn.gob.senasa.sigerh',
      );

      if (intakeRequest) {
        await qr.manager.update(
          EmployeeIntakeRequest,
          { id: intakeRequest.id },
          {
            status: 'CONVERTED',
            converted_employee_id: savedEmployee.id,
            converted_at: new Date(),
          },
        );
      }

      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();

      for (const filePath of writtenFiles) {
        this.storageService.deleteFile(filePath);
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      console.log(error);

      throw new InternalServerErrorException(['Error al crear el empleado.']);
    } finally {
      await qr.release();
    }

    let watchSynchronization: { created: boolean; userId: string } | null = null;
    let watchSynchronizationWarning: string | null = null;
    if (savedEmployee) {
      try {
        watchSynchronization = await this.watchUsersService.createFromEmployee(savedEmployee);
      } catch (error) {
        watchSynchronizationWarning =
          error instanceof Error ? error.message : 'No se pudo crear el usuario en el reloj.';
        console.error('Empleado creado, pero no fue posible sincronizarlo con el reloj:', error);
      }
    }

    for (const file of filesToConvertAfterCommit) {
      try {
        const pdfPath = this.storageService.convertStoredWordToPdf(
          file.filePath,
          file.folder,
          file.fileName,
        );

        await this._EmployeeDocument.update(file.documentId, {
          filePath: pdfPath,
          extension: 'pdf',
          mimeType: 'application/pdf',
          fileName: `${path.parse(file.fileName).name}.pdf`,
        });
      } catch (error) {
        console.error(
          'Empleado creado, pero falló conversión de Word a PDF:',
          error,
        );
      }
    }

    return {
      message: 'Empleado creado correctamente.',
      employee: savedEmployee,
      watchSynchronization,
      watchSynchronizationWarning,
    };
  }

  async remove(id: string) {
    const qr = this.dataSource.createQueryRunner();

    await qr.connect();
    await qr.startTransaction();

    const documentPathsToDelete: string[] = [];
    let restoredIntakeRequestId: string | null = null;

    try {
      const employee = await qr.manager.findOne(Employee, {
        where: { id },
      });

      if (!employee) {
        throw new NotFoundException('Empleado no encontrado.');
      }

      const blockingChecks = await Promise.all([
        qr.manager.query(
          'SELECT COUNT(*)::int AS total FROM vacation_requests WHERE employee_id = $1 OR boss_employee_id = $1 OR hr_employee_id = $1',
          [id],
        ),
        qr.manager.query(
          'SELECT COUNT(*)::int AS total FROM employee_exit_permits WHERE employee_id = $1 OR boss_employee_id = $1 OR hr_employee_id = $1',
          [id],
        ),
        qr.manager.query(
          'SELECT COUNT(*)::int AS total FROM employee_job_actions WHERE employee_id = $1',
          [id],
        ),
        qr.manager.query(
          'SELECT COUNT(*)::int AS total FROM area_managers WHERE employee_id = $1',
          [id],
        ),
        qr.manager.query(
          'SELECT COUNT(*)::int AS total FROM employee_payment_receipts WHERE employee_id = $1',
          [id],
        ),
      ]);

      const [
        vacationRequestsCount,
        exitPermitsCount,
        jobActionsCount,
        areaManagersCount,
        payrollReceiptsCount,
      ] = blockingChecks.map((result) => Number(result?.[0]?.total || 0));

      if (
        vacationRequestsCount > 0 ||
        exitPermitsCount > 0 ||
        jobActionsCount > 0 ||
        areaManagersCount > 0 ||
        payrollReceiptsCount > 0
      ) {
        throw new BadRequestException([
          'No se puede eliminar este empleado porque ya tiene movimientos operativos registrados.',
        ]);
      }

      const documents = await qr.manager.find(EmployeeDocument, {
        where: { employeeId: id },
      });

      documentPathsToDelete.push(
        ...documents.map((document) => document.filePath).filter(Boolean),
      );

      const user = await qr.manager.findOne(User, {
        where: { employeeId: id },
      });

      const intakeRequest = await qr.manager.findOne(EmployeeIntakeRequest, {
        where: {
          converted_employee_id: id,
        },
      });

      await qr.manager.query(
        'DELETE FROM employee_government_vacation_exclusions WHERE employee_id = $1',
        [id],
      );
      await qr.manager.query(
        'DELETE FROM vacation_movements WHERE employee_id = $1',
        [id],
      );
      await qr.manager.query(
        'DELETE FROM employee_vacation_periods WHERE employee_id = $1',
        [id],
      );
      await qr.manager.delete(EmployeeDocument, { employeeId: id });
      await qr.manager.delete(EmployeeUnpaidLeave, { employeeId: id });
      await qr.manager.delete(AcademicHistory, { employeeId: id });
      await qr.manager.delete(EmployeeEmergencyContact, { employeeId: id });
      await qr.manager.delete(EmployeeJobRecord, { employeeId: id });

      if (user) {
        await qr.manager.query(
          'DELETE FROM roles_user WHERE user_id::text = $1',
          [user.id],
        );
        await qr.manager.delete(User, { id: user.id });
      }

      await qr.manager.delete(Employee, { id });

      if (intakeRequest) {
        intakeRequest.status = 'REVIEWED';
        intakeRequest.converted_employee_id = null;
        intakeRequest.converted_at = null;
        await qr.manager.save(EmployeeIntakeRequest, intakeRequest);
        restoredIntakeRequestId = intakeRequest.id;
      }

      await qr.commitTransaction();
    } catch (error) {
      await qr.rollbackTransaction();

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      console.log(error);
      throw new InternalServerErrorException([
        'Error al eliminar el empleado.',
      ]);
    } finally {
      await qr.release();
    }

    for (const filePath of documentPathsToDelete) {
      this.storageService.deleteFile(filePath);
    }

    return {
      message:
        'Empleado eliminado correctamente. La solicitud temporal asociada quedó revisada para reconvertir.',
      id,
      restoredIntakeRequestId,
    };
  }

  async createMany(
    employeeId: string,
    documents: DocumentDto[],
    manager: EntityManager,
    writtenFiles: string[],
  ) {
    if (!documents?.length) return [];

    const savedDocuments: EmployeeDocument[] = [];

    for (const doc of documents) {
      const fileName = `${crypto.randomUUID()}.${doc.extension}`;
      const folder = `employees/${employeeId}`;

      const filePath = this.storageService.saveBase64File(
        doc.base64,
        folder,
        fileName,
      );

      writtenFiles.push(filePath);

      const employeeDocument = manager.create(EmployeeDocument, {
        employeeId,
        documentType: doc.documentTypeKey,
        fileName,
        originalName: doc.originalName,
        extension: doc.extension,
        mimeType: doc.mimeType,
        fileSize: doc.size,
        filePath,
        expirationDate: parseDateOnly(doc.expirationDate),
        notes: doc.notes,
        isActive: true,
        isPrivate: false,
      });

      const saved = await manager.save(EmployeeDocument, employeeDocument);
      savedDocuments.push(saved);
    }

    return savedDocuments;
  }

  async copyIntakeGeneralDocuments(
    employeeId: string,
    documents: PublicIntakeGeneralDocumentRecord[],
    manager: EntityManager,
    writtenFiles: string[],
    filesToConvertAfterCommit: {
      documentId: string;
      filePath: string;
      folder: string;
      fileName: string;
    }[],
  ) {
    if (!documents?.length) return [];

    const savedDocuments: EmployeeDocument[] = [];

    for (const doc of documents) {
      if (!doc.filePath) {
        continue;
      }

      const extension = (doc.extension || 'pdf').replace('.', '').toLowerCase();
      const fileName = `${randomUUID()}.${extension}`;
      const folder = `employees/${employeeId}`;
      const filePath = this.storageService.copyStoredFile(
        doc.filePath,
        folder,
        fileName,
      );

      writtenFiles.push(filePath);

      const employeeDocument = manager.create(EmployeeDocument, {
        employeeId,
        documentType: doc.documentTypeKey || 'general',
        fileName,
        originalName: doc.originalName || doc.name || fileName,
        extension,
        mimeType: doc.mimeType || 'application/octet-stream',
        fileSize: Number(doc.size || 0),
        filePath,
        expirationDate: doc.expirationDate
          ? parseDateOnly(doc.expirationDate)
          : null,
        notes: doc.notes || 'Documento importado desde solicitud temporal',
        isActive: true,
        isPrivate: false,
      });

      const saved = await manager.save(EmployeeDocument, employeeDocument);
      savedDocuments.push(saved);

      if (extension === 'doc' || extension === 'docx') {
        filesToConvertAfterCommit.push({
          documentId: saved.id,
          filePath,
          folder,
          fileName,
        });
      }
    }

    return savedDocuments;
  }

  async getPersonByIdentity(identity: string): Promise<any> {
    let rnp: any = null;
    let InternalRNP: any = null;

    const personQuery = this._employee
      .createQueryBuilder('p')
      .where('p.dni = :identity', {
        identity,
      });

    const resultPerson = await personQuery.getOne();

    if (resultPerson) {
      const detailedPerson = await this.findOne(resultPerson.id);

      return {
        person: {
          id: detailedPerson.id,
          employeeCode: detailedPerson.employeeCode,
          dni: detailedPerson.dni,
          fullName: detailedPerson.fullName,
          firstName: detailedPerson.firstName,
          middleName: detailedPerson.middleName,
          lastName: detailedPerson.lastName,
          secondLastName: detailedPerson.secondLastName,
          email: detailedPerson.email,
          phone: detailedPerson.phone,
          status: detailedPerson.status,
          regionalName: detailedPerson.regionalName,
          regionalAddress: detailedPerson.regionalAddress,
          scheduleDescription: detailedPerson.scheduleDescription,
          scheduleStartTime: detailedPerson.scheduleStartTime,
          scheduleEndTime: detailedPerson.scheduleEndTime,
          modalityName: detailedPerson.modalityName,
          functionalPositionName: detailedPerson.functionalPositionName,
          nominalPositionName: detailedPerson.nominalPositionName,
          departmentName: detailedPerson.departmentName,
          departmentId: detailedPerson.departmentId,
          emergencyContact: detailedPerson.emergencyContact,
        },
        rnp,
        InternalRNP,
      };
    }

    InternalRNP = await this._RnpService.getDataByDni(identity);
    if (!InternalRNP) {
      rnp = await this._rnpService.getDataByDni(identity);
    }

    return { person: null, rnp, InternalRNP };
  }

  async test(dto: {
    email: string;
    firstName: string;
    middleName: string;
    lastName: string;
  }) {
    await sendNewEmployee(
      dto.email,
      `${dto.firstName} ${dto.lastName} bienvenido al Portal del Empleado`,
      'testtest',
      `${dto.firstName} ${dto.middleName}, ${dto.lastName}`,
      'temporalsenasa2026',
      'https://play.google.com/store/apps/details?id=hn.gob.senasa.sigerh',
    );
  }

  async getEmployeeDocumentDownload(documentId: string) {
    const document = await this._EmployeeDocument.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado.');
    }

    return {
      absolutePath: this.storageService.getAbsolutePath(document.filePath),
      originalName: document.originalName || document.fileName || 'documento',
    };
  }

  async findByDni(dni: string) {
    return this._employee.findOne({
      where: { dni },
    });
  }

  private normalizeOptionalString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }
}
