import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { Regional } from '../regional/entities/regional.entity';
import { CreateRegionalManagerDto } from './dto/create-regional-manager.dto';
import { RegionalManager } from './entities/regional-manager.entity';

@Injectable()
export class RegionalManagerService {
  constructor(
    @InjectRepository(RegionalManager)
    private readonly regionalManagerRepository: Repository<RegionalManager>,
    @InjectRepository(Regional)
    private readonly regionalRepository: Repository<Regional>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) {}

  async findAll() {
    const records = await this.regionalManagerRepository.find({
      where: { is_active: true },
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
      createdAt: record.created_at || null,
    }));
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
      { regional_id: regional.id, is_active: true },
      { is_active: false },
    );

    const manager = await this.regionalManagerRepository.save(
      this.regionalManagerRepository.create({
        regional_id: regional.id,
        employee_id: employee.id,
        is_active: true,
      }),
    );

    return this.regionalManagerRepository.findOne({
      where: { id: manager.id },
      relations: { employee: true, regional: true },
    });
  }

  findActiveByRegional(regionalId: string) {
    return this.regionalManagerRepository.findOne({
      where: { regional_id: regionalId, is_active: true },
      relations: { employee: true, regional: true },
      order: { created_at: 'DESC' },
    });
  }

  findRegionalIdsByEmployee(employeeId: string) {
    return this.regionalManagerRepository
      .find({
        where: { employee_id: employeeId, is_active: true },
        select: ['regional_id'],
      })
      .then((records) => records.map((record) => record.regional_id));
  }
}
