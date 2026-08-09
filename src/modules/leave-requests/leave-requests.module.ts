import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../../common/common.module';
import { AreaManagerModule } from '../area-manager/area-manager.module';
import { Components } from '../components/entities/components.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { EmployeeUnpaidLeave } from '../employees/entities/employee-unpaid-leave.entity';
import { Holiday } from '../holiday/entities/holiday.entity';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { User } from '../users/entities/user.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveVacationImpact } from './entities/leave-vacation-impact.entity';
import { LeaveRequestsController } from './leave-requests.controller';
import { LeaveRequestsService } from './leave-requests.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaveRequest,
      LeaveVacationImpact,
      User,
      Holiday,
      Components,
      RolUser,
      EmployeeUnpaidLeave,
      EmployeeVacationPeriod,
    ]),
    AreaManagerModule,
    CommonModule,
  ],
  controllers: [LeaveRequestsController],
  providers: [LeaveRequestsService],
})
export class LeaveRequestsModule implements OnModuleInit {
  constructor(private readonly service: LeaveRequestsService) {}
  async onModuleInit() {
    await this.service.initializeModule();
  }
}
