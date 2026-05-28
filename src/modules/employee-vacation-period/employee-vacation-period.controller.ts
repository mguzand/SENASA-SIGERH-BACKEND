import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EmployeeVacationPeriodService } from './employee-vacation-period.service';
import { BootstrapVacationPeriodsDto } from './dto/bootstrap-vacation-periods.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('employee-vacation-period')
export class EmployeeVacationPeriodController {
  constructor(
    private readonly employeeVacationPeriodService: EmployeeVacationPeriodService,
  ) {}

  @Post('bootstrap')
  bootstrap(@Body() dto: BootstrapVacationPeriodsDto) {
    return this.employeeVacationPeriodService.bootstrap(dto);
  }

  @Post('process')
  process() {
    return this.employeeVacationPeriodService.processVacationPeriods();
  }

  @Public()
  @Get('employee/:employeeId/available-days')
  getAvailableDays(@Param('employeeId') employeeId: string) {
    return this.employeeVacationPeriodService.getAvailableDays(employeeId);
  }

  @Public()
  @Get('employee/:employeeId/history')
  getEmployeeHistory(@Param('employeeId') employeeId: string) {
    return this.employeeVacationPeriodService.getEmployeeHistory(employeeId);
  }

  @Public()
  @Get(':periodId/detail')
  getPeriodDetail(@Param('periodId') periodId: string) {
    return this.employeeVacationPeriodService.getPeriodDetail(periodId);
  }
}
