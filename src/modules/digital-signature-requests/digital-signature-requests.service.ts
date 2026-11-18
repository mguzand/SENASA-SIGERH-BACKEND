import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { StorageService } from '../../common/services/storage.service';
import { sendRequestNotification } from '../../common/helpers/send-email.helper';
import { Employee } from '../employees/entities/employee.entity';
import { CreateDigitalSignatureRequestDto } from './dto/create-digital-signature-request.dto';
import { ListDigitalSignatureRequestsDto } from './dto/list-digital-signature-requests.dto';
import { DigitalSignatureRequest } from './entities/digital-signature-request.entity';

@Injectable()
export class DigitalSignatureRequestsService {
  constructor(
    @InjectRepository(DigitalSignatureRequest) private readonly requests: Repository<DigitalSignatureRequest>,
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  async lookup(identity: string) {
    if (!/^\d{13}$/.test(identity)) throw new BadRequestException('La identidad debe contener 13 dígitos.');
    const employee = await this.employees.findOne({ where: { dni: identity, status: 'ACTIVE' } });
    if (!employee) throw new NotFoundException('No se encontró un empleado activo con esa identidad.');
    return {
      identity: employee.dni,
      fullName: this.fullName(employee),
      email: employee.email || '',
      phone: employee.phone || '',
    };
  }

  async create(dto: CreateDigitalSignatureRequestDto) {
    const employee = await this.employees.findOne({ where: { dni: dto.identity, status: 'ACTIVE' } });
    if (!employee) throw new NotFoundException('No se encontró un empleado activo con esa identidad.');
    const files: string[] = [];
    try {
      const front = this.saveImage(dto.identityFrontBase64, dto.identityFrontMimeType, employee.id, 'front');
      const back = this.saveImage(dto.identityBackBase64, dto.identityBackMimeType, employee.id, 'back');
      const selfie = this.saveImage(dto.selfieBase64, dto.selfieMimeType, employee.id, 'selfie');
      files.push(front, back, selfie);
      const saved = await this.dataSource.transaction(async (manager) => {
        await manager.update(Employee, employee.id, { email: dto.email.trim().toLowerCase(), phone: dto.phone.trim() });
        await manager.query(
          `UPDATE users SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE employee_id = $2`,
          [dto.email.trim().toLowerCase(), employee.id],
        );
        return manager.save(DigitalSignatureRequest, manager.create(DigitalSignatureRequest, {
          employeeId: employee.id,
          identity: employee.dni,
          fullName: this.fullName(employee),
          email: dto.email.trim().toLowerCase(),
          phone: dto.phone.trim(),
          identityFrontPath: front,
          identityFrontMimeType: dto.identityFrontMimeType,
          identityBackPath: back,
          identityBackMimeType: dto.identityBackMimeType,
          selfiePath: selfie,
          selfieMimeType: dto.selfieMimeType,
          status: 'PENDING',
        }));
      });
      void sendRequestNotification(
        'stephanny.alvarado@senasa.gob.hn, berlin.neto@senasa.gob.hn',
        'Nueva solicitud de firma digital',
        'Equipo de firma digital',
        `${saved.fullName} completó una nueva solicitud de firma digital.`,
        [`Identidad: ${saved.identity}`, `Correo: ${saved.email}`, `Teléfono: ${saved.phone}`],
      );
      return { id: saved.id, message: 'Solicitud de firma digital enviada correctamente.' };
    } catch (error) {
      files.forEach((file) => this.storage.deleteFile(file));
      throw error;
    }
  }

  async findAll(query: ListDigitalSignatureRequestsDto, username?: string) {
    this.assertMguzman(username);
    const qb = this.requests.createQueryBuilder('request').orderBy('request.createdAt', 'DESC');
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.where('LOWER(request.fullName) LIKE :search OR request.identity LIKE :search OR LOWER(request.email) LIKE :search', { search });
    }
    const [items, total] = await qb.skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { items: items.map((item) => this.serialize(item)), total, page: query.page, limit: query.limit };
  }

  async getDocument(id: string, type: 'front' | 'back' | 'selfie', username?: string) {
    this.assertMguzman(username);
    const request = await this.requests.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada.');
    const values = type === 'front'
      ? [request.identityFrontPath, request.identityFrontMimeType]
      : type === 'back'
        ? [request.identityBackPath, request.identityBackMimeType]
        : [request.selfiePath, request.selfieMimeType];
    return { absolutePath: this.storage.getAbsolutePath(values[0]), mimeType: values[1] };
  }

  private saveImage(base64: string, mime: string, employeeId: string, side: string) {
    const raw = base64.replace(/^data:image\/(?:png|jpeg|webp);base64,/, '');
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) throw new BadRequestException('Cada imagen debe pesar máximo 5 MB.');
    const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
    return this.storage.saveBase64File(raw, 'digital-signature-requests', `${employeeId}-${side}-${randomUUID()}.${extension}`);
  }

  private assertMguzman(username?: string) {
    if (String(username || '').trim().toLowerCase() !== 'mguzman') throw new ForbiddenException('Acceso exclusivo para mguzman.');
  }
  private fullName(employee: Employee) { return [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName].filter(Boolean).join(' '); }
  private serialize(item: DigitalSignatureRequest) {
    return { id: item.id, identity: item.identity, fullName: item.fullName, email: item.email, phone: item.phone, status: item.status, createdAt: item.createdAt };
  }
}
