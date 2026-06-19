import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { EmployeeVacationPeriodService } from './employee-vacation-period.service';
import { BootstrapVacationPeriodsDto } from './dto/bootstrap-vacation-periods.dto';
import { Public } from 'src/common/decorators/public.decorator';
import {
  ManualAdjustVacationPeriodsDto,
  PreviewAdjustVacationPeriodsDto,
} from './dto/manual-adjust-vacation-periods.dto';

@Controller('employee-vacation-period')
export class EmployeeVacationPeriodController {
  constructor(
    private readonly employeeVacationPeriodService: EmployeeVacationPeriodService,
  ) {}

  @Post('bootstrap')
  bootstrap(@Body() dto: BootstrapVacationPeriodsDto) {
    return this.employeeVacationPeriodService.bootstrap(dto);
  }

  @Public()
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

  @Patch('employee/:employeeId/manual-adjustment')
  manualAdjustPeriods(
    @Param('employeeId') employeeId: string,
    @Body() dto: ManualAdjustVacationPeriodsDto,
    @Req() req: any,
  ) {
    return this.employeeVacationPeriodService.manualAdjustPeriods(
      employeeId,
      dto,
      req.user?.id ?? null,
    );
  }

  @Post('employee/:employeeId/manual-adjustment-preview')
  previewManualAdjustPeriods(
    @Param('employeeId') employeeId: string,
    @Body() dto: PreviewAdjustVacationPeriodsDto,
  ) {
    return this.employeeVacationPeriodService.previewManualAdjustPeriods(
      employeeId,
      dto,
    );
  }
}
