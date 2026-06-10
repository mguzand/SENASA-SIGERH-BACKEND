import { Body, Controller, Post, Req } from '@nestjs/common';
import { EmployeeJobActionsService } from './employee-job-actions.service';
import { CreateEmployeeJobActionDto } from './dto/create-employee-job-action.dto';

@Controller('employee-job-actions')
export class EmployeeJobActionsController {
  constructor(
    private readonly employeeJobActionsService: EmployeeJobActionsService,
  ) {}

  @Post()
  create(@Body() dto: CreateEmployeeJobActionDto, @Req() req: any) {
    return this.employeeJobActionsService.create(dto, req.user?.id ?? null);
  }
}
