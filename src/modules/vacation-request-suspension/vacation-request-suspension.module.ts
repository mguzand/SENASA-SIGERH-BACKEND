import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaManagerModule } from '../area-manager/area-manager.module';
import { EmployeeVacationPeriodModule } from '../employee-vacation-period/employee-vacation-period.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { VacationMovementModule } from '../vacation-movement/vacation-movement.module';
import { VacationRequestDetailModule } from '../vacation-request-detail/vacation-request-detail.module';
import { VacationRequest } from '../vacation-request/entities/vacation-request.entity';
import { VacationRequestDaysModule } from '../vacation_request_days/vacation_request_days.module';
import { VacationRequestSuspensionController } from './vacation-request-suspension.controller';
import { VacationRequestSuspension } from './entities/vacation-request-suspension.entity';
import { VacationRequestSuspensionService } from './vacation-request-suspension.service';
import { VacationRequestReschedule } from './entities/vacation-request-reschedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([VacationRequestSuspension, VacationRequest, VacationRequestReschedule]),
    VacationRequestDaysModule,
    VacationRequestDetailModule,
    EmployeeVacationPeriodModule,
    VacationMovementModule,
    AreaManagerModule,
    PushNotificationsModule,
  ],
  controllers: [VacationRequestSuspensionController],
  providers: [VacationRequestSuspensionService],
  exports: [VacationRequestSuspensionService],
})
export class VacationRequestSuspensionModule {}
