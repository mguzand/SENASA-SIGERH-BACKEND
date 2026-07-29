import { Module } from '@nestjs/common';
import { AreaManagerService } from './area-manager.service';
import { AreaManagerController } from './area-manager.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaManager } from './entities/area-manager.entity';
import { CommonModule } from 'src/common/common.module';
import { AreaManagerCron } from './cron/area-manager.cron';
import { RegionalManager } from './entities/regional-manager.entity';
import { RegionalManagerService } from './regional-manager.service';
import { ApprovalRoutingService } from './approval-routing.service';
import { Employee } from '../employees/entities/employee.entity';
import { Regional } from '../regional/entities/regional.entity';

@Module({
  controllers: [AreaManagerController],
  providers: [
    AreaManagerService,
    RegionalManagerService,
    ApprovalRoutingService,
    AreaManagerCron,
  ],
  imports: [
    TypeOrmModule.forFeature([
      AreaManager,
      RegionalManager,
      Employee,
      Regional,
    ]),
    CommonModule,
  ],
  exports: [
    AreaManagerService,
    RegionalManagerService,
    ApprovalRoutingService,
  ],
})
export class AreaManagerModule {}
