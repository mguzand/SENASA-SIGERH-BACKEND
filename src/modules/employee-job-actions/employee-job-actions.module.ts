import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmployeeJobActionsController } from './employee-job-actions.controller';
import { EmployeeJobActionsService } from './employee-job-actions.service';
import { EmployeeJobAction } from './entities/employee-job-action.entity';

import { EmployeeJobRecordModule } from '../employee-job-record/employee-job-record.module';
import { EmployeeVacationPeriodModule } from '../employee-vacation-period/employee-vacation-period.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeJobAction]),
    EmployeeJobRecordModule,
    EmployeeVacationPeriodModule,
  ],
  controllers: [EmployeeJobActionsController],
  providers: [EmployeeJobActionsService],
  exports: [EmployeeJobActionsService],
})
export class EmployeeJobActionsModule {}
