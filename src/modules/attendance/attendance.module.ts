import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../../common/common.module';
import { EmployeeExitPermit } from '../employee-exit-permits/entities/employee-exit-permit.entity';
import { Components } from '../components/entities/components.entity';
import { Employee } from '../employees/entities/employee.entity';
import { GovernmentVacationDay } from '../government-vacation-day/entities/government-vacation-day.entity';
import { Holiday } from '../holiday/entities/holiday.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { VacationRequest } from '../vacation-request/entities/vacation-request.entity';
import { WatchesModule } from '../watches/watches.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { MonthlyAttendancePdfReport } from './reports/monthly-attendance.report';

@Module({
  imports: [TypeOrmModule.forFeature([Employee, VacationRequest, EmployeeExitPermit, LeaveRequest, Holiday, GovernmentVacationDay, Components]), WatchesModule, CommonModule],
  controllers: [AttendanceController], providers: [AttendanceService, MonthlyAttendancePdfReport],
})
export class AttendanceModule implements OnModuleInit {
  constructor(private readonly attendanceService: AttendanceService) {}
  async onModuleInit() { await this.attendanceService.ensurePermissionComponent(); }
}
