import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { EmployeeExitPermitsService } from './employee-exit-permits.service';
import { CreateEmployeeExitPermitDto } from './dto/create-employee-exit-permit.dto';
import { ReviewEmployeeExitPermitDto } from './dto/review-employee-exit-permit.dto';
import { ListHrExitPermitsDto } from './dto/list-hr-exit-permits.dto';
import { UpdateExitPermitSupportDto } from './dto/update-exit-permit-support.dto';

@Controller('employee-exit-permits')
export class EmployeeExitPermitsController {
  constructor(
    private readonly employeeExitPermitsService: EmployeeExitPermitsService,
  ) {}

  @Post()
  create(@Body() dto: CreateEmployeeExitPermitDto, @Req() req: any) {
    const authenticatedEmployeeId = this.getEmployeeId(req);
    if (!authenticatedEmployeeId) {
      throw new BadRequestException('El usuario autenticado no tiene empleado asociado');
    }
    return this.employeeExitPermitsService.create({
      ...dto,
      employee_id: authenticatedEmployeeId,
    });
  }

  @Get('hr/inbox')
  findHrInbox(@Query() query: ListHrExitPermitsDto, @Req() req: any) {
    return this.employeeExitPermitsService.findHrInbox(
      query,
      this.getEmployeeId(req),
    );
  }

  @Get('boss/inbox')
  findBossInbox(@Query() query: ListHrExitPermitsDto, @Req() req: any) {
    return this.employeeExitPermitsService.findBossInbox(
      query,
      this.getEmployeeId(req),
    );
  }

  @Get('mine')
  findMine(@Req() req: any) {
    return this.employeeExitPermitsService.findMine(this.getEmployeeId(req));
  }

  @Get('boss/:id')
  findBossDetail(@Param('id') id: string, @Req() req: any) {
    return this.employeeExitPermitsService.findBossDetail(
      id,
      this.getEmployeeId(req),
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
      this.getEmployeeId(req),
    );
  }

  @Get(':id/support')
  async support(@Param('id') id: string, @Req() req: any, @Res() response: Response) {
    const support = await this.employeeExitPermitsService.getSupport(id, this.getEmployeeId(req));
    response.setHeader('Content-Type', support.mimeType);
    response.setHeader('Content-Disposition', 'inline; filename="respaldo-pase.jpg"');
    response.sendFile(support.absolutePath);
  }

  @Patch(':id/support')
  updateSupport(@Param('id') id: string, @Body() dto: UpdateExitPermitSupportDto, @Req() req: any) {
    return this.employeeExitPermitsService.updateSupport(id, dto.base64FileFoto, this.getEmployeeId(req));
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
      this.getEmployeeId(req),
    );
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
