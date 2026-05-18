import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';

import { VacationRequestService } from './vacation-request.service';
import { CreateVacationRequestDto } from './dtos/create-vacation-request.dto';
import { ReviewVacationRequestDto } from './dtos/review-vacation-request.dto';

@Controller('vacation-requests')
export class VacationRequestController {
  constructor(
    private readonly vacationRequestService: VacationRequestService,
  ) {}

  @Post()
  create(@Body() dto: CreateVacationRequestDto) {
    return this.vacationRequestService.create(dto);
  }

  @Patch(':id/boss-review')
  bossReview(
    @Param('id') id: string,
    @Body() dto: ReviewVacationRequestDto,
    @Req() req: any,
  ) {
    return this.vacationRequestService.bossReview(
      id,
      dto,
      req.user.employee_id,
    );
  }

  @Patch(':id/hr-review')
  hrReview(
    @Param('id') id: string,
    @Body() dto: ReviewVacationRequestDto,
    @Req() req: any,
  ) {
    return this.vacationRequestService.hrReview(id, dto, req.user.employee_id);
  }

  @Get()
  findAll() {
    return this.vacationRequestService.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.vacationRequestService.findByEmployee(employeeId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vacationRequestService.findOne(id);
  }
}
