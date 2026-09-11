import { Module } from '@nestjs/common';
import { GovernmentVacationDayService } from './government-vacation-day.service';
import { GovernmentVacationDayController } from './government-vacation-day.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernmentVacationDay } from './entities/government-vacation-day.entity';
import { EmployeeGovernmentVacationExclusion } from '../employee-government-vacation-exclusion/entities/employee-government-vacation-exclusion.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { VacationMovementModule } from '../vacation-movement/vacation-movement.module';

@Module({
  controllers: [GovernmentVacationDayController],
  providers: [GovernmentVacationDayService],
  imports: [
    TypeOrmModule.forFeature([
      GovernmentVacationDay,
      EmployeeGovernmentVacationExclusion,
      Employee,
      EmployeeVacationPeriod,
    ]),
    VacationMovementModule,
  ],
})
export class GovernmentVacationDayModule {}
