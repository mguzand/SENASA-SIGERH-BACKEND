import { Module } from '@nestjs/common';
import { PositionService } from './position.service';
import { PositionController } from './position.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './entities/position.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';

@Module({
  controllers: [PositionController],
  providers: [PositionService],
  imports: [TypeOrmModule.forFeature([Position, EmployeeJobRecord])],
})
export class PositionModule {}
