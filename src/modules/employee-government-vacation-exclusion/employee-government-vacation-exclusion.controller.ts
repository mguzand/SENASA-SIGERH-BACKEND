import { Controller } from '@nestjs/common';
import { EmployeeGovernmentVacationExclusionService } from './employee-government-vacation-exclusion.service';

@Controller('employee-government-vacation-exclusion')
export class EmployeeGovernmentVacationExclusionController {
  constructor(private readonly employeeGovernmentVacationExclusionService: EmployeeGovernmentVacationExclusionService) {}
}
