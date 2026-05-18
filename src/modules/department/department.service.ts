import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationalUnit } from './entities/organizational-unit.entity';
import { OrganizationalUnitType } from './entities/organizational_unit_types';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(OrganizationalUnit)
    private readonly organizationalUnitRepository: Repository<OrganizationalUnit>,
    @InjectRepository(OrganizationalUnitType)
    private readonly organizationalUnitTypeRepository: Repository<OrganizationalUnitType>,
  ) {}

  async findAllOrganizationalUnitTypes() {
    return await this.organizationalUnitTypeRepository.find({
      order: { code: 'ASC' },
    });
  }

  async findOrganizationalUnitsByType(unit_type: string) {
    return await this.organizationalUnitRepository.find({
      where: { unit_type },
      order: { code: 'ASC' },
    });
  }
}
