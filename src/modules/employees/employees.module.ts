import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from './entities/employee.entity';
import { CommonModule } from 'src/common/common.module';
import { RnpModule } from '../rnp/rnp.module';
import { EmployeeDocument } from './entities/employee-document.entity';
import { AcademicHistoryModule } from '../academic-history/academic-history.module';
import { EmployeeJobRecordModule } from '../employee-job-record/employee-job-record.module';
import { EmployeeEmergencyContact } from './entities/emergency_contacts.interface';
import { EmployeeVacationPeriodModule } from '../employee-vacation-period/employee-vacation-period.module';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeDocument,
      EmployeeEmergencyContact,
    ]),
    CommonModule,
    RnpModule,
    AcademicHistoryModule,
    EmployeeJobRecordModule,
    EmployeeVacationPeriodModule,
  ],
})
export class EmployeesModule {}
