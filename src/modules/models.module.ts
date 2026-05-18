import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { EmployeesModule } from './employees/employees.module';
import { RolesModule } from './roles/roles.module';
import { SchedulesModule } from './schedules/schedules.module';
import { RegionalModule } from './regional/regional.module';
import { EmploymentModalitiesModule } from './employment_modalities/employment_modalities.module';
import { EmployeeJobRecordModule } from './employee-job-record/employee-job-record.module';
import { PositionModule } from './position/position.module';
import { ComponentsModule } from './components/components.module';
import { RolModule } from './rol/rol.module';
import { RolUserModule } from './rol-user/rol-user.module';
import { DepartmentModule } from './department/department.module';
import { WatchesModule } from './watches/watches.module';
import { RnpModule } from './rnp/rnp.module';
import { AcademicHistoryModule } from './academic-history/academic-history.module';
import { HolidayModule } from './holiday/holiday.module';
import { AreaManagerModule } from './area-manager/area-manager.module';
import { EmployeeExitPermitsModule } from './employee-exit-permits/employee-exit-permits.module';
import { VacationContractRuleModule } from './vacation-contract-rule/vacation-contract-rule.module';
import { EmployeeVacationPeriodModule } from './employee-vacation-period/employee-vacation-period.module';
import { VacationRequestDetailModule } from './vacation-request-detail/vacation-request-detail.module';
import { VacationMovementModule } from './vacation-movement/vacation-movement.module';
import { VacationRequestModule } from './vacation-request/vacation-request.module';
import { GovernmentVacationDayModule } from './government-vacation-day/government-vacation-day.module';
import { EmployeeGovernmentVacationExclusionModule } from './employee-government-vacation-exclusion/employee-government-vacation-exclusion.module';
import { VacationRequestDaysModule } from './vacation_request_days/vacation_request_days.module';

@Module({
  imports: [
    UsersModule,
    EmployeesModule,
    RolesModule, //
    SchedulesModule,
    RegionalModule,
    EmploymentModalitiesModule,
    EmployeeJobRecordModule,
    PositionModule,
    ComponentsModule,
    RolModule,
    RolUserModule,
    DepartmentModule,
    WatchesModule,
    RnpModule,
    AcademicHistoryModule,
    HolidayModule,
    AreaManagerModule,
    EmployeeExitPermitsModule,
    VacationContractRuleModule,
    EmployeeVacationPeriodModule,
    VacationRequestDetailModule,
    VacationMovementModule,
    VacationRequestModule,
    GovernmentVacationDayModule,
    EmployeeGovernmentVacationExclusionModule,
    VacationRequestDaysModule,
  ],
  exports: [],
})
export class ModelsModule {}
