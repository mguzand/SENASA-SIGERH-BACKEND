import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../common/auth/interfaces/authenticated-request.interface';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { ListLeaveRequestsDto } from './dto/list-leave-requests.dto';
import { ReviewLeaveRequestDto } from './dto/review-leave-request.dto';
import { LeaveRequestsService } from './leave-requests.service';

@Controller('leave-requests')
export class LeaveRequestsController {
  constructor(private readonly service: LeaveRequestsService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLeaveRequestDto) {
    return this.service.create(this.userId(req), dto);
  }

  @Get('mine')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.service.findMine(this.userId(req));
  }

  @Get('hr/inbox')
  findHrInbox(@Req() req: AuthenticatedRequest, @Query() query: ListLeaveRequestsDto) {
    return this.service.findHrInbox(this.userId(req), query);
  }

  @Get('manager/inbox')
  findManagerInbox(@Req() req: AuthenticatedRequest, @Query() query: ListLeaveRequestsDto) {
    return this.service.findManagerInbox(this.userId(req), query);
  }

  @Patch(':id/manager-review')
  reviewByManager(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.service.reviewByManager(this.userId(req), id, dto);
  }

  @Get('director/inbox')
  findDirectorInbox(@Req() req: AuthenticatedRequest, @Query() query: ListLeaveRequestsDto) {
    return this.service.findDirectorInbox(this.userId(req), query);
  }

  @Get('director/access')
  directorAccess(@Req() req: AuthenticatedRequest) {
    return this.service.getDirectorAccess(this.userId(req));
  }

  @Patch(':id/hr-review')
  reviewByHr(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.service.reviewByHr(this.userId(req), id, dto);
  }

  @Patch(':id/director-review')
  reviewByDirector(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ReviewLeaveRequestDto) {
    return this.service.reviewByDirector(this.userId(req), id, dto);
  }

  @Get(':id/pdf/:destination')
  async pdf(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('destination') destinationRaw: string,
    @Res() response: Response,
  ) {
    const destination = destinationRaw.toUpperCase();
    if (destination !== 'HR' && destination !== 'DIRECTOR') {
      response.status(400).json({ message: 'Destino de documento inválido.' });
      return;
    }
    const result = await this.service.generatePdf(this.userId(req), id, destination);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `inline; filename="licencia-${result.requestNumber}.pdf"`);
    result.pdf.pipe(response);
    result.pdf.end();
  }

  @Get(':id/documents/:documentId')
  async document(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Res() response: Response,
  ) {
    const document = await this.service.getDocument(this.userId(req), id, documentId);
    response.setHeader('Content-Type', document.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
    response.sendFile(document.absolutePath);
  }

  private userId(request: AuthenticatedRequest) {
    return request.user.id || request.user.sub || '';
  }
}
