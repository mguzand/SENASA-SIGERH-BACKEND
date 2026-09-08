import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';

import { VacationRequestService } from './vacation-request.service';
import { CreateVacationRequestDto } from './dtos/create-vacation-request.dto';
import { ReviewVacationRequestDto } from './dtos/review-vacation-request.dto';
import { ListHrVacationRequestsDto } from './dtos/list-hr-vacation-requests.dto';
import { AuthGuard } from '@nestjs/passport';
import { CreateManualVacationRequestDto } from './dtos/create-manual-vacation-request.dto';

@Controller('vacation-requests')
export class VacationRequestController {
  constructor(
    private readonly vacationRequestService: VacationRequestService,
  ) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() request, @Body() dto: CreateVacationRequestDto) {
    return this.vacationRequestService.create(dto, request.user);
  }

  @Post('seen/vacations')
  @UseGuards(AuthGuard('jwt'))
  tesSeenVacations(@Req() request, @Body() dto: CreateVacationRequestDto) {
    return this.vacationRequestService.testEndpoint(dto, request.user);
  }

  @Post('manual')
  createManual(@Body() dto: CreateManualVacationRequestDto, @Req() req: any) {
    return this.vacationRequestService.createManual(
      dto,
      this.getEmployeeId(req),
    );
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
      this.getEmployeeId(req),
    );
  }

  @Patch(':id/hr-review')
  hrReview(
    @Param('id') id: string,
    @Body() dto: ReviewVacationRequestDto,
    @Req() req: any,
  ) {
    return this.vacationRequestService.hrReview(
      id,
      dto,
      this.getEmployeeId(req),
    );
  }

  @Get('hr/inbox')
  hrInbox(@Query() query: ListHrVacationRequestsDto, @Req() req: any) {
    return this.vacationRequestService.findHrInbox(
      query,
      this.getEmployeeId(req),
    );
  }

  @Get('liaison/inbox')
  liaisonInbox(@Req() req: any) {
    return this.vacationRequestService.findLiaisonInbox(this.getEmployeeId(req));
  }

  @Patch(':id/liaison-review')
  liaisonReview(@Param('id') id: string, @Body() dto: ReviewVacationRequestDto, @Req() req: any) {
    return this.vacationRequestService.liaisonReview(id, dto, this.getEmployeeId(req));
  }

  @Get('boss/inbox')
  bossInbox(@Query() query: ListHrVacationRequestsDto, @Req() req: any) {
    return this.vacationRequestService.findBossInbox(
      query,
      this.getEmployeeId(req),
    );
  }

  @Get()
  findAll() {
    return this.vacationRequestService.findAll();
  }

  @Get('employee/:employeeId')
  findByEmployee(@Param('employeeId') employeeId: string) {
    return this.vacationRequestService.findByEmployee(employeeId);
  }

  @Get(':id/pdf')
  async pdf(@Param('id') id: string, @Req() req: any, @Res() response: Response) {
    const document = await this.vacationRequestService.generatePdf(id, this.getEmployeeId(req));
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
    document.pdf.pipe(response);
    document.pdf.end();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vacationRequestService.findOne(id);
  }

  private getEmployeeId(req: any): string {
    return (
      req.user?.employee_id ??
      req.user?.employeeId ??
      req.user?.employees?.id ??
      req.user?.employee?.id
    );
  }
}
