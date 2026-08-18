import { Module, OnModuleInit } from '@nestjs/common';
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
import { UsersModule } from '../users/users.module';
import { EmployeeIntakeRequest } from '../employee-intake/entities/employee-intake.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { EmployeeUnpaidLeave } from './entities/employee-unpaid-leave.entity';
import { WatchUsersModule } from '../watch-users/watch-users.module';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService],
  imports: [
    TypeOrmModule.forFeature([
      Employee,
      EmployeeDocument,
      EmployeeEmergencyContact,
      EmployeeIntakeRequest,
      EmployeeJobRecord,
      EmployeeUnpaidLeave,
    ]),
    CommonModule,
    RnpModule,
    AcademicHistoryModule,
    EmployeeJobRecordModule,
    EmployeeVacationPeriodModule,
    UsersModule,
    WatchUsersModule,
  ],
  exports: [EmployeesService],
})
export class EmployeesModule implements OnModuleInit {
  constructor(private readonly employeesService: EmployeesService) {}

  async onModuleInit() {
    await this.employeesService.initializeBiometricIdSequence();
  }
}
