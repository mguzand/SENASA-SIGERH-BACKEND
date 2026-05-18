import { Module } from '@nestjs/common';
import { VacationRequestDayService } from './vacation_request_days.service';
import { VacationRequestDaysController } from './vacation_request_days.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationRequestDay } from './entities/vacation_request_days.entity';

@Module({
  controllers: [VacationRequestDaysController],
  providers: [VacationRequestDayService],
  imports: [TypeOrmModule.forFeature([VacationRequestDay])],
  exports: [VacationRequestDayService],
})
export class VacationRequestDaysModule {}
