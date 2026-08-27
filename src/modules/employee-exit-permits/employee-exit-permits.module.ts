import { Module } from '@nestjs/common';
import { EmployeeExitPermitsService } from './employee-exit-permits.service';
import { EmployeeExitPermitsController } from './employee-exit-permits.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeExitPermit } from './entities/employee-exit-permit.entity';
import { AreaManagerModule } from '../area-manager/area-manager.module';
import { Employee } from '../employees/entities/employee.entity';
import { CommonModule } from '../../common/common.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';

@Module({
  controllers: [EmployeeExitPermitsController],
  providers: [EmployeeExitPermitsService],
  imports: [
    TypeOrmModule.forFeature([EmployeeExitPermit, Employee]),
    AreaManagerModule,
    CommonModule,
    PushNotificationsModule,
  ],
})
export class EmployeeExitPermitsModule {}
