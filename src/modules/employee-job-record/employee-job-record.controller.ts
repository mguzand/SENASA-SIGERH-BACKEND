import { Controller } from '@nestjs/common';
import { EmployeeJobRecordService } from './employee-job-record.service';

@Controller('employee-job-record')
export class EmployeeJobRecordController {
  constructor(private readonly employeeJobRecordService: EmployeeJobRecordService) {}
}
