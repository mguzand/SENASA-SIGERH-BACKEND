import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeDocument } from '../employees/entities/employee-document.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { VacationRequest } from '../vacation-request/entities/vacation-request.entity';
import { EmployeeExitPermit } from '../employee-exit-permits/entities/employee-exit-permit.entity';
import { EmployeeIntakeRequest } from '../employee-intake/entities/employee-intake.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeDocument,
      EmployeeVacationPeriod,
      VacationRequest,
      EmployeeExitPermit,
      EmployeeIntakeRequest,
      EmployeeJobRecord,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
