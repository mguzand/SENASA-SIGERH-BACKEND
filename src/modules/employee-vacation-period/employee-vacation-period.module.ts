import { Module } from '@nestjs/common';
import { EmployeeVacationPeriodService } from './employee-vacation-period.service';
import { EmployeeVacationPeriodController } from './employee-vacation-period.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeVacationPeriod } from './entities/employee-vacation-period.entity';
import { VacationPeriodCron } from './cron/vacation-period.cron';
import { VacationMovementModule } from '../vacation-movement/vacation-movement.module';
import { VacationContractRuleModule } from '../vacation-contract-rule/vacation-contract-rule.module';

@Module({
  controllers: [EmployeeVacationPeriodController],
  providers: [EmployeeVacationPeriodService, VacationPeriodCron],
  imports: [
    TypeOrmModule.forFeature([EmployeeVacationPeriod]),
    VacationMovementModule,
    VacationContractRuleModule,
  ],
  exports: [EmployeeVacationPeriodService],
})
export class EmployeeVacationPeriodModule {}
