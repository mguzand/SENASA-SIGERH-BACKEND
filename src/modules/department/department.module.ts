import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationalUnit } from './entities/organizational-unit.entity';
import { OrganizationalUnitType } from './entities/organizational_unit_types';
import { ConfigModule } from '@nestjs/config';
import { AreaHierarchyService } from './area-hierarchy.service';

@Module({
  controllers: [DepartmentController],
  providers: [DepartmentService, AreaHierarchyService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([OrganizationalUnit, OrganizationalUnitType]),
  ],
})
export class DepartmentModule {}
