import { Body, Controller, Get, Param, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { SuspendVacationRequestDto } from './dto/suspend-vacation-request.dto';
import { VacationRequestSuspensionService } from './vacation-request-suspension.service';

@Controller('vacation-requests')
export class VacationRequestSuspensionController {
  constructor(private readonly service: VacationRequestSuspensionService) {}

  @Post(':id/suspend')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  suspend(@Param('id') id: string, @Body() dto: SuspendVacationRequestDto, @Req() req: any) {
    return this.service.suspend(id, dto, this.getEmployeeId(req));
  }

  @Get(':id/suspensions')
  findByRequest(@Param('id') id: string) {
    return this.service.findByRequest(id);
  }

  private getEmployeeId(req: any): string {
    return req.user?.employee_id ?? req.user?.employeeId ?? req.user?.employees?.id ?? req.user?.employee?.id;
  }
}
