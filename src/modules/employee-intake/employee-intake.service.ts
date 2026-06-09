import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Brackets, Repository } from 'typeorm';
import { StorageService } from 'src/common/services/storage.service';
import {
  parseDateOnly,
  serializeDateOnly,
} from 'src/common/utils/date-only.util';
import { CreateEmployeeIntakeDto } from './dto/create-employee-intake.dto';
import { EmployeeIntakeRequest } from './entities/employee-intake.entity';
import { ListEmployeeIntakeDto } from './dto/list-employee-intake.dto';
import { ReviewEmployeeIntakeDto } from './dto/review-employee-intake.dto';

@Injectable()
export class EmployeeIntakeService {
  constructor(
    @InjectRepository(EmployeeIntakeRequest)
    private readonly employeeIntakeRepository: Repository<EmployeeIntakeRequest>,
    private readonly storageService: StorageService,
  ) {}

  async create(dto: CreateEmployeeIntakeDto) {
    const identity = dto.identity.trim();
    const rtn = dto.rtn.trim();

    if (!identity || !rtn || !dto.cv_base64?.trim()) {
      throw new BadRequestException(
        'Identidad, RTN y Curriculum Vitae son obligatorios',
      );
    }

    if (!dto.criminal_record_base64?.trim() || !dto.criminal_record_expiration_date) {
      throw new BadRequestException(
        'Antecedentes penales y su fecha de vencimiento son obligatorios',
      );
    }

    let filePath: string | null = null;
    let criminalRecordFilePath: string | null = null;
    let previousFilePath: string | null = null;
    let previousCriminalRecordFilePath: string | null = null;

    try {
      const extension = (dto.cv_extension || 'pdf').replace('.', '').toLowerCase();
      const fileName = `${identity}-${randomUUID()}.${extension}`;

      filePath = this.storageService.saveBase64File(
        dto.cv_base64,
        'employee-intake/cv',
        fileName,
      );

      if (dto.criminal_record_base64?.trim()) {
        const criminalExtension = (dto.criminal_record_extension || 'pdf')
          .replace('.', '')
          .toLowerCase();
        const criminalFileName = `${identity}-criminal-record-${randomUUID()}.${criminalExtension}`;

        criminalRecordFilePath = this.storageService.saveBase64File(
          dto.criminal_record_base64,
          'employee-intake/criminal-record',
          criminalFileName,
        );
      }

      const existing = await this.employeeIntakeRepository.findOne({
        where: { identity },
      });

      previousFilePath = existing?.cv_file_path || null;
      previousCriminalRecordFilePath = existing?.criminal_record_file_path || null;

      const entity = this.employeeIntakeRepository.create({
        id: existing?.id,
        identity,
        full_name: dto.full_name?.trim() || null,
        rtn,
        marital_status: dto.marital_status?.trim() || null,
        blood_type: dto.blood_type?.trim() || null,
        email: dto.email?.trim() || null,
        home_address: dto.home_address?.trim() || null,
        birth_place: existing?.birth_place || null,
        phone: existing?.phone || null,
        cv_file_path: filePath,
        cv_original_name: dto.cv_original_name?.trim() || null,
        cv_extension: extension,
        cv_mime_type: dto.cv_mime_type?.trim() || null,
        criminal_record_file_path:
          criminalRecordFilePath || existing?.criminal_record_file_path || null,
        criminal_record_original_name:
          dto.criminal_record_original_name?.trim() ||
          existing?.criminal_record_original_name ||
          null,
        criminal_record_extension:
          dto.criminal_record_base64?.trim()
            ? (dto.criminal_record_extension || 'pdf').replace('.', '').toLowerCase()
            : existing?.criminal_record_extension || null,
        criminal_record_mime_type:
          dto.criminal_record_mime_type?.trim() ||
          existing?.criminal_record_mime_type ||
          null,
        criminal_record_expiration_date: dto.criminal_record_base64?.trim()
          ? parseDateOnly(dto.criminal_record_expiration_date)
          : existing?.criminal_record_expiration_date || null,
        status: existing?.status === 'CONVERTED' ? 'CONVERTED' : existing?.status === 'REVIEWED' ? 'REVIEWED' : 'PENDING',
        converted_employee_id: existing?.converted_employee_id || null,
        converted_at: existing?.converted_at || null,
        no_organizational_type: existing?.no_organizational_type || null,
        area_id: existing?.area_id || null,
        nominal_position: existing?.nominal_position || null,
        functional_position: existing?.functional_position || null,
        start_date: existing?.start_date || null,
        salary: existing?.salary || null,
        modality_id: existing?.modality_id || null,
        schedule_id: existing?.schedule_id || null,
        regional_id: existing?.regional_id || null,
        employee_status: existing?.employee_status || null,
        biometric_id: existing?.biometric_id || null,
        emergency_contact_name: existing?.emergency_contact_name || null,
        emergency_contact_relationship: existing?.emergency_contact_relationship || null,
        emergency_contact_phone: existing?.emergency_contact_phone || null,
      });

      const saved = await this.employeeIntakeRepository.save(entity);

      if (previousFilePath && previousFilePath !== filePath) {
        this.storageService.deleteFile(previousFilePath);
      }

      if (
        previousCriminalRecordFilePath &&
        criminalRecordFilePath &&
        previousCriminalRecordFilePath !== criminalRecordFilePath
      ) {
        this.storageService.deleteFile(previousCriminalRecordFilePath);
      }

      return {
        message: existing
          ? 'Solicitud actualizada correctamente'
          : 'Solicitud enviada correctamente',
        id: saved.id,
        identity: saved.identity,
        createdAt: saved.created_at,
      };
    } catch (error) {
      if (filePath) {
        this.storageService.deleteFile(filePath);
      }

      if (criminalRecordFilePath) {
        this.storageService.deleteFile(criminalRecordFilePath);
      }

      throw error;
    }
  }

  async findAll(params: ListEmployeeIntakeDto) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 8, 1), 50);
    const status = params.status || 'pending';

    const query = this.employeeIntakeRepository.createQueryBuilder('request');

    if (status === 'pending') {
      query.andWhere('request.status = :status', { status: 'PENDING' });
    }

    if (status === 'converted') {
      query.andWhere('request.status = :status', { status: 'CONVERTED' });
    }

    if (status === 'reviewed') {
      query.andWhere('request.status = :status', { status: 'REVIEWED' });
    }

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(request.identity) LIKE :search', { search });
          qb.orWhere('LOWER(request.rtn) LIKE :search', { search });
          qb.orWhere('LOWER(COALESCE(request.full_name, \'\')) LIKE :search', { search });
          qb.orWhere('LOWER(COALESCE(request.email, \'\')) LIKE :search', { search });
        }),
      );
    }

    query.orderBy('request.created_at', 'DESC');

    const [records, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsBase = this.employeeIntakeRepository.createQueryBuilder('request');
    const [pending, reviewed, converted, totalAll] = await Promise.all([
      statsBase.clone().where('request.status = :status', { status: 'PENDING' }).getCount(),
      statsBase.clone().where('request.status = :status', { status: 'REVIEWED' }).getCount(),
      statsBase.clone().where('request.status = :status', { status: 'CONVERTED' }).getCount(),
      statsBase.clone().getCount(),
    ]);

    return {
      data: records.map((record) => ({
        id: record.id,
        identity: record.identity,
        fullName: record.full_name,
        rtn: record.rtn,
        maritalStatus: record.marital_status,
        bloodType: record.blood_type,
        email: record.email,
        homeAddress: record.home_address,
        cvOriginalName: record.cv_original_name,
        criminalRecordOriginalName: record.criminal_record_original_name,
        criminalRecordExpirationDate: serializeDateOnly(
          record.criminal_record_expiration_date,
        ),
        status: String(record.status || 'PENDING').toLowerCase(),
        convertedEmployeeId: record.converted_employee_id,
        createdAt: record.created_at,
        convertedAt: record.converted_at,
        reviewedAt: record.updated_at,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        pending,
        reviewed,
        converted,
        total: totalAll,
      },
    };
  }

  async findOne(id: string) {
    const record = await this.employeeIntakeRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('Solicitud temporal no encontrada');
    }

    return {
      id: record.id,
      identity: record.identity,
      fullName: record.full_name,
      rtn: record.rtn,
      maritalStatus: record.marital_status,
      bloodType: record.blood_type,
      email: record.email,
      homeAddress: record.home_address,
      birthPlace: record.birth_place,
      phone: record.phone,
      cvOriginalName: record.cv_original_name,
      cvExtension: record.cv_extension,
      cvMimeType: record.cv_mime_type,
      cvFilePath: record.cv_file_path,
      criminalRecordOriginalName: record.criminal_record_original_name,
      criminalRecordExtension: record.criminal_record_extension,
      criminalRecordMimeType: record.criminal_record_mime_type,
      criminalRecordFilePath: record.criminal_record_file_path,
      criminalRecordExpirationDate: serializeDateOnly(
        record.criminal_record_expiration_date,
      ),
      status: String(record.status || 'PENDING').toLowerCase(),
      convertedEmployeeId: record.converted_employee_id,
      createdAt: record.created_at,
      convertedAt: record.converted_at,
      reviewedAt: record.updated_at,
      noOrganizationalType: record.no_organizational_type,
      areaId: record.area_id,
      nominalPosition: record.nominal_position,
      functionalPosition: record.functional_position,
      startDate: serializeDateOnly(record.start_date),
      salary: record.salary !== null && record.salary !== undefined ? Number(record.salary) : null,
      modalityId: record.modality_id,
      scheduleId: record.schedule_id,
      regionalId: record.regional_id,
      employeeStatus: record.employee_status,
      biometricId: record.biometric_id,
      emergencyContactName: record.emergency_contact_name,
      emergencyContactRelationship: record.emergency_contact_relationship,
      emergencyContactPhone: record.emergency_contact_phone,
    };
  }

  async findPendingEntity(id: string) {
    const record = await this.employeeIntakeRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('Solicitud temporal no encontrada');
    }

    if (record.status === 'CONVERTED') {
      throw new BadRequestException('Esta solicitud ya fue convertida en empleado');
    }

    return record;
  }

  async review(id: string, dto: ReviewEmployeeIntakeDto) {
    const record = await this.findPendingEntity(id);

    record.identity = dto.identity.trim();
    record.rtn = dto.rtn.trim();
    record.birth_place = dto.birth_place.trim();
    record.marital_status = dto.marital_status.trim();
    record.blood_type = dto.blood_type.trim();
    record.email = dto.email.trim();
    record.phone = dto.phone.trim();
    record.no_organizational_type = dto.no_organizational_type?.trim() || null;
    record.area_id = dto.area_id;
    record.nominal_position = dto.nominal_position;
    record.functional_position = dto.functional_position;
    record.start_date = parseDateOnly(dto.start_date);
    record.salary = dto.salary;
    record.modality_id = dto.modality_id;
    record.schedule_id = dto.schedule_id;
    record.regional_id = dto.regional_id;
    record.employee_status = dto.employee_status?.trim() || null;
    record.biometric_id = dto.biometric_id?.trim() || null;
    record.emergency_contact_name = dto.emergency_contact_name?.trim() || null;
    record.emergency_contact_relationship =
      dto.emergency_contact_relationship?.trim() || null;
    record.emergency_contact_phone = dto.emergency_contact_phone?.trim() || null;
    record.status = 'REVIEWED';

    await this.employeeIntakeRepository.save(record);

    return {
      message: 'Solicitud revisada correctamente',
      id: record.id,
      status: 'reviewed',
      reviewedAt: record.updated_at,
    };
  }

  async markAsConverted(id: string, employeeId: string) {
    await this.employeeIntakeRepository.update(
      { id },
      {
        status: 'CONVERTED',
        converted_employee_id: employeeId,
        converted_at: new Date(),
      },
    );
  }

  async remove(id: string) {
    const record = await this.employeeIntakeRepository.findOne({ where: { id } });

    if (!record) {
      throw new NotFoundException('Solicitud temporal no encontrada');
    }

    if (!['PENDING', 'REVIEWED'].includes(String(record.status || '').toUpperCase())) {
      throw new BadRequestException(
        'Solo se pueden eliminar solicitudes temporales en estado pendiente o revisada',
      );
    }

    await this.employeeIntakeRepository.remove(record);

    if (record.cv_file_path) {
      this.storageService.deleteFile(record.cv_file_path);
    }

    if (record.criminal_record_file_path) {
      this.storageService.deleteFile(record.criminal_record_file_path);
    }

    return {
      message: 'Solicitud temporal eliminada correctamente',
      id,
    };
  }

}
