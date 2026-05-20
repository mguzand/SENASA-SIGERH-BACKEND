import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Position } from './entities/position.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { ListPositionDashboardDto } from './dto/list-position-dashboard.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    @InjectRepository(EmployeeJobRecord)
    private readonly employeeJobRecordRepository: Repository<EmployeeJobRecord>,
  ) {}

  async findAll() {
    return await this.positionRepository.find({
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreatePositionDto) {
    const existsCode = await this.positionRepository.findOne({
      where: { code: dto.code.trim() },
    });

    if (existsCode) {
      throw new BadRequestException('Ya existe un puesto con este código');
    }

    const position = this.positionRepository.create({
      code: 'dto.code.trim()',
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      responsibilities: dto.responsibilities?.trim() || null,
      requirements: dto.requirements?.trim() || null,
      isActive: dto.isActive ?? true,
    });

    return this.positionRepository.save(position);
  }

  async update(id: string, dto: UpdatePositionDto) {
    const position = await this.positionRepository.findOne({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Puesto no encontrado');
    }

    const assignedCount = await this.countAssignedEmployees(id);
    if (assignedCount > 0) {
      throw new BadRequestException(
        'No se puede editar un puesto con empleados asignados',
      );
    }

    if (dto.code && dto.code.trim() !== position.code) {
      const existsCode = await this.positionRepository.findOne({
        where: { code: dto.code.trim() },
      });

      if (existsCode && existsCode.id !== id) {
        throw new BadRequestException('Ya existe un puesto con este código');
      }
    }

    position.code = dto.code?.trim() ?? position.code;
    position.name = dto.name?.trim() ?? position.name;
    position.description =
      dto.description !== undefined
        ? dto.description?.trim() || null
        : position.description;
    position.responsibilities =
      dto.responsibilities !== undefined
        ? dto.responsibilities?.trim() || null
        : position.responsibilities;
    position.requirements =
      dto.requirements !== undefined
        ? dto.requirements?.trim() || null
        : position.requirements;
    if (dto.isActive !== undefined) {
      position.isActive = dto.isActive;
    }

    return this.positionRepository.save(position);
  }

  async remove(id: string) {
    const position = await this.positionRepository.findOne({
      where: { id },
    });

    if (!position) {
      throw new NotFoundException('Puesto no encontrado');
    }

    const assignedCount = await this.countAssignedEmployees(id);
    if (assignedCount > 0) {
      throw new BadRequestException(
        'No se puede eliminar un puesto con empleados asignados',
      );
    }

    await this.positionRepository.delete(id);

    return { message: 'Puesto eliminado correctamente' };
  }

  async dashboard(params: ListPositionDashboardDto) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 9, 1), 50);

    const query = this.positionRepository
      .createQueryBuilder('position')
      .leftJoin(
        EmployeeJobRecord,
        'record',
        `(record.nominal_position = position.id OR record.functional_position = position.id)
         AND LOWER(record.status) = :status`,
        {
          status: 'active',
        },
      )
      .leftJoin('record.area', 'area');

    if (params.departmentId?.trim()) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('area.id = :departmentId', {
            departmentId: params.departmentId!.trim(),
          });
        }),
      );
    }

    if (params.search?.trim()) {
      const search = `%${params.search.trim().toLowerCase()}%`;

      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(position.name) LIKE :search', { search });
          qb.orWhere("LOWER(COALESCE(position.description, '')) LIKE :search", {
            search,
          });
          qb.orWhere("LOWER(COALESCE(area.name, '')) LIKE :search", { search });
          qb.orWhere("LOWER(COALESCE(position.code, '')) LIKE :search", {
            search,
          });
        }),
      );
    }

    const groupedQuery = query
      .clone()
      .select('position.id', 'positionId')
      .addSelect('position.code', 'positionCode')
      .addSelect('position.name', 'positionName')
      .addSelect('position.description', 'positionDescription')
      .addSelect('position.isActive', 'isActive')
      .addSelect('area.id', 'departmentId')
      .addSelect('area.name', 'departmentName')
      .addSelect('COUNT(DISTINCT record.id)', 'employeeCount')
      .groupBy('position.id')
      .addGroupBy('position.code')
      .addGroupBy('position.name')
      .addGroupBy('position.description')
      .addGroupBy('position.isActive')
      .addGroupBy('area.id')
      .addGroupBy('area.name')
      .orderBy('position.name', 'ASC')
      .addOrderBy('area.name', 'ASC');

    const total = (await groupedQuery.clone().getRawMany()).length;
    const data = await groupedQuery
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const statsBaseQuery = this.positionRepository
      .createQueryBuilder('position')
      .leftJoin(
        EmployeeJobRecord,
        'record',
        `(record.nominal_position = position.id OR record.functional_position = position.id)
         AND LOWER(record.status) = :status`,
        {
          status: 'active',
        },
      )
      .leftJoin('record.area', 'area');

    const [
      totalPositionsRaw,
      departmentsCoveredRaw,
      employeesAssignedRaw,
      withoutDepartmentRaw,
    ] = await Promise.all([
      this.positionRepository
        .createQueryBuilder('position')
        .select('COUNT(position.id)', 'total')
        .getRawOne(),
      statsBaseQuery
        .clone()
        .andWhere('area.id IS NOT NULL')
        .select('COUNT(DISTINCT area.id)', 'total')
        .getRawOne(),
      statsBaseQuery
        .clone()
        .select('COUNT(DISTINCT record.id)', 'total')
        .getRawOne(),
      this.positionRepository
        .createQueryBuilder('position')
        .leftJoin(
          EmployeeJobRecord,
          'record',
          `(record.nominal_position = position.id OR record.functional_position = position.id)
             AND LOWER(record.status) = :status`,
          {
            status: 'active',
          },
        )
        .leftJoin('record.area', 'area')
        .where('record.id IS NULL OR area.id IS NULL')
        .select('COUNT(DISTINCT position.id)', 'total')
        .getRawOne(),
    ]);

    return {
      data: data.map((item) => ({
        id: item.positionId,
        code: item.positionCode,
        name: item.positionName,
        description: item.positionDescription,
        departmentId: item.departmentId,
        departmentName: item.departmentName || 'Sin departamento',
        employeeCount: Number(item.employeeCount || 0),
        isActive:
          item.isActive === true ||
          item.isActive === 'true' ||
          item.isActive === '1' ||
          item.isActive === 1,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalPositions: Number(totalPositionsRaw?.total || 0),
        departmentsCovered: Number(departmentsCoveredRaw?.total || 0),
        employeesAssigned: Number(employeesAssignedRaw?.total || 0),
        withoutDepartment: Number(withoutDepartmentRaw?.total || 0),
      },
    };
  }

  private async countAssignedEmployees(positionId: string) {
    return this.employeeJobRecordRepository
      .createQueryBuilder('record')
      .where(
        '(record.nominal_position = :positionId OR record.functional_position = :positionId)',
        { positionId },
      )
      .andWhere('LOWER(record.status) = :status', {
        status: 'active',
      })
      .getCount();
  }
}
