import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationalUnit } from './entities/organizational-unit.entity';
import { OrganizationalUnitType } from './entities/organizational_unit_types';

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentService],
  imports: [
    TypeOrmModule.forFeature([OrganizationalUnit, OrganizationalUnitType]),
  ],
})
export class DepartmentModule {}
