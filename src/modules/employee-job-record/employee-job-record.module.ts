import { Module } from '@nestjs/common';
import { EmployeeJobRecordService } from './employee-job-record.service';
import { EmployeeJobRecordController } from './employee-job-record.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeJobRecord } from './entities/employee-job-record.entity';

@Module({
  controllers: [EmployeeJobRecordController],
  providers: [EmployeeJobRecordService],
  imports: [TypeOrmModule.forFeature([EmployeeJobRecord])],
  exports: [EmployeeJobRecordService],
})
export class EmployeeJobRecordModule {}
