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
import { EmployeeIntakeRequest } from '../employee-intake/entities/employee-intake.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { UpdateEmployeeEditableDto } from './dtos/update-employee-editable.dto';
import * as path from 'path';
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
  ) {}

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
          status: String(employee.status || '').toUpperCase(),
          entryDate: employee.entryDate,
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
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )
      .leftJoinAndSelect('employee.documents', 'document')
      .where('employee.id = :id', { id })
      .orderBy('document.created_at', 'DESC')
      .getOne();

    if (!employee) {
      throw new NotFoundException('Empleado no encontrado.');
    }

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
      birthDate: employee.birth_date,
      birthPlace: employee.birth_place,
      address: employee.address,
      entryDate: employee.entryDate,
      gender: employee.gender,
      maritalStatus: employee.marital_status,
      bloodType: employee.type_blood,
      biometricId: employee.biometric_id,
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
          expirationDate: document.expirationDate,
          notes: document.notes,
        })) || [],
    };
  }

  async updateEditableData(id: string, dto: UpdateEmployeeEditableDto) {
    const qr = this.dataSource.createQueryRunner();
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

      if (dto.biometric_id !== undefined) {
        (employee as any).biometric_id = dto.biometric_id?.trim() || null;
      }

      if (dto.nominal_position !== undefined) {
        activeJobRecord.nominal_position = dto.nominal_position || null;
        (employee as any).position_id = dto.nominal_position || null;
      }

      if (dto.functional_position !== undefined) {
        activeJobRecord.functional_position = dto.functional_position || null;
      }

      if (dto.salary !== undefined) {
        (activeJobRecord as any).salary =
          dto.salary !== null ? Number(dto.salary) : null;
      }

      await qr.manager.save(Employee, employee);
      await qr.manager.save(EmployeeJobRecord, activeJobRecord);
      await qr.commitTransaction();

      return this.findOne(id);
    } catch (error) {
      await qr.rollbackTransaction();

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
      }

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
      const employee = qr.manager.create(Employee, {
        dni: dto.dni,
        rtn: dto.rtn,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        secondLastName: dto.secondLastName,
        gender: dto.gender,
        marital_status: dto.marital_status,
        type_blood: dto.type_blood,
        birth_date: dto.birth_date ? new Date(dto.birth_date) : null,
        birth_place: dto.birth_place,
        address: dto.address,
        entryDate: dto.start_date ? new Date(dto.start_date) : new Date(),
        schedule_id: dto.schedule_id,
        regional_id: dto.regional_id,
        status: dto.status ? String(dto.status).toUpperCase() : 'ACTIVE',
        email: dto.email,
        phone: dto.phone,
        position_id: dto.position_id,
        biometric_id: dto.biometric_id,
      });

      savedEmployee = await qr.manager.save(Employee, employee);

      //! ///////////////////////////////////////////////////////////////////////////////////////////
      //!creamos el insert del contacto de emergencia usando el id del empleado que acabamos de crear
      if (
        dto.emergency_contact_name &&
        dto.emergency_contact_relationship &&
        dto.emergency_contact_phone
      ) {
        const employeeEmergencyContact = qr.manager.create(
          EmployeeEmergencyContact,
          {
            employeeId: savedEmployee.id,
            emergency_contact_name: dto.emergency_contact_name,
            emergency_contact_relationship: dto.emergency_contact_relationship,
            emergency_contact_phone: dto.emergency_contact_phone,
          },
        );
        await qr.manager.save(
          EmployeeEmergencyContact,
          employeeEmergencyContact,
        );
      }

      //! //////////////////////////////////////////////////////////////////////////////////////////
      //! creamos el insert de la historia academica usando el id del empleado que acabamos de crear
      if (dto.academicHistory?.length) {
        await this.academicHistoryService.createMany(
          savedEmployee.id,
          dto.academicHistory || [],
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
            expirationDate: doc.expirationDate
              ? new Date(doc.expirationDate)
              : null,
            notes: doc.notes,
            isActive: true,
            isPrivate: false,
          });
        }
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
          expirationDate: intakeRequest.criminal_record_expiration_date
            ? new Date(intakeRequest.criminal_record_expiration_date)
            : null,
          notes: 'Documento importado desde solicitud temporal',
          isActive: true,
          isPrivate: false,
        });
      }

      //! ////////////////////////////////////////////////////////////////////////////
      //!creamos el insert para crear el usuario asociado al empleado con rol estándar;
      await this._usersService.createUser(
        {
          employeeId: savedEmployee.id,
          username: `${dto.firstName.toLowerCase()}.${dto.lastName.toLowerCase()}`,
          email: dto.email,
          password: 'temporalsenasa2026',
        },
        qr.manager,
      );

      await sendNewEmployee(
        dto.email,
        `${dto.firstName} ${dto.lastName} bienvenido al Portal del Empleado`,
        `${dto.firstName.toLowerCase()}.${dto.lastName.toLowerCase()}`,
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
        expirationDate: doc.expirationDate
          ? new Date(doc.expirationDate)
          : null,
        notes: doc.notes,
        isActive: true,
        isPrivate: false,
      });

      const saved = await manager.save(EmployeeDocument, employeeDocument);
      savedDocuments.push(saved);
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

    if (!resultPerson) {
      InternalRNP = await this._RnpService.getDataByDni(identity);
      if (!InternalRNP) {
        rnp = await this._rnpService.getDataByDni(identity);
      }
    }

    return { person: resultPerson, rnp, InternalRNP };
  }
}
