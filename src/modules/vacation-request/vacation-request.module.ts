import { Module } from '@nestjs/common';
import { VacationRequestService } from './vacation-request.service';
import { VacationRequestController } from './vacation-request.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationRequestAdjustment } from './entities/vacation-request-adjustment.entity';
import { VacationRequest } from './entities/vacation-request.entity';
import { VacationRequestDaysModule } from '../vacation_request_days/vacation_request_days.module';
import { VacationRequestDetailModule } from '../vacation-request-detail/vacation-request-detail.module';
import { EmployeeVacationPeriodModule } from '../employee-vacation-period/employee-vacation-period.module';
import { VacationMovementModule } from '../vacation-movement/vacation-movement.module';
import { AreaManagerModule } from '../area-manager/area-manager.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  controllers: [VacationRequestController],
  providers: [VacationRequestService],
  imports: [
    TypeOrmModule.forFeature([VacationRequest, VacationRequestAdjustment]),
    VacationRequestDaysModule,
    VacationRequestDetailModule,
    EmployeeVacationPeriodModule,
    VacationMovementModule,
    AreaManagerModule,
    PushNotificationsModule,
  ],
})
export class VacationRequestModule {}
