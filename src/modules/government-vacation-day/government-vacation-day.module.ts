import { Module } from '@nestjs/common';
import { GovernmentVacationDayService } from './government-vacation-day.service';
import { GovernmentVacationDayController } from './government-vacation-day.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernmentVacationDay } from './entities/government-vacation-day.entity';

@Module({
  controllers: [GovernmentVacationDayController],
  providers: [GovernmentVacationDayService],
  imports: [TypeOrmModule.forFeature([GovernmentVacationDay])],
})
export class GovernmentVacationDayModule {}
