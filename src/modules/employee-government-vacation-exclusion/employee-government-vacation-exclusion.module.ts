import { Module } from '@nestjs/common';
import { EmployeeGovernmentVacationExclusionService } from './employee-government-vacation-exclusion.service';
import { EmployeeGovernmentVacationExclusionController } from './employee-government-vacation-exclusion.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeGovernmentVacationExclusion } from './entities/employee-government-vacation-exclusion.entity';

@Module({
  controllers: [EmployeeGovernmentVacationExclusionController],
  providers: [EmployeeGovernmentVacationExclusionService],
  imports: [TypeOrmModule.forFeature([EmployeeGovernmentVacationExclusion])],
})
export class EmployeeGovernmentVacationExclusionModule {}
