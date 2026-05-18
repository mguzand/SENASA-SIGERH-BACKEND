import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { EmployeeExitPermitsService } from './employee-exit-permits.service';
import { CreateEmployeeExitPermitDto } from './dto/create-employee-exit-permit.dto';
import { ReviewEmployeeExitPermitDto } from './dto/review-employee-exit-permit.dto';
import { ListHrExitPermitsDto } from './dto/list-hr-exit-permits.dto';

@Controller('employee-exit-permits')
export class EmployeeExitPermitsController {
  constructor(
    private readonly employeeExitPermitsService: EmployeeExitPermitsService,
  ) {}

  @Post()
  create(@Body() dto: CreateEmployeeExitPermitDto) {
    return this.employeeExitPermitsService.create(dto);
  }

  @Get('hr/inbox')
  findHrInbox(@Query() query: ListHrExitPermitsDto, @Req() req: any) {
    return this.employeeExitPermitsService.findHrInbox(
      query,
      req.user.employee_id,
    );
  }

  @Patch(':id/review-boss')
  reviewByBoss(
    @Param('id') id: string,
    @Body() dto: ReviewEmployeeExitPermitDto,
    @Req() req: any,
  ) {
    return this.employeeExitPermitsService.reviewByBoss(
      id,
      dto,
      req.user.employee_id,
    );
  }

  @Patch(':id/review-hr')
  reviewByHr(
    @Param('id') id: string,
    @Body() dto: ReviewEmployeeExitPermitDto,
    @Req() req: any,
  ) {
    return this.employeeExitPermitsService.reviewByHr(
      id,
      dto,
      req.user.employee_id,
    );
  }
}
