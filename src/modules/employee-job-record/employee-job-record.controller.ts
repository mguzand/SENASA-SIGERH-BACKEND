import { Controller, Get, Param } from '@nestjs/common';
import { EmployeeJobRecordService } from './employee-job-record.service';

@Controller('employee-job-record')
export class EmployeeJobRecordController {
  constructor(private readonly employeeJobRecordService: EmployeeJobRecordService) {}

  @Get('employee/:employeeId/timeline')
  getEmployeeTimeline(@Param('employeeId') employeeId: string) {
    return this.employeeJobRecordService.getEmployeeTimeline(employeeId);
  }
}
