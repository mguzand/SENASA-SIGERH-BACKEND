import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { AuthenticatedRequest } from '../../common/auth/interfaces/authenticated-request.interface';
import { CreateEmploymentCertificateRequestDto } from './dto/create-employment-certificate-request.dto';
import { ListEmploymentCertificateRequestsDto } from './dto/list-employment-certificate-requests.dto';
import { UpdateEmploymentCertificateStatusDto } from './dto/update-employment-certificate-status.dto';
import { EmploymentCertificateRequestsService } from './employment-certificate-requests.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('employment-certificate-requests')
export class EmploymentCertificateRequestsController {
  constructor(private readonly service: EmploymentCertificateRequestsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateEmploymentCertificateRequestDto,
  ) {
    return this.service.create(this.getRequesterId(request), dto);
  }

  @Get('hr/inbox')
  findHrInbox(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListEmploymentCertificateRequestsDto,
  ) {
    return this.service.findHrInbox(this.getRequesterId(request), query);
  }

  @Get('mine')
  findMine(@Req() request: AuthenticatedRequest) {
    return this.service.findMine(this.getRequesterId(request));
  }

  @Get(':id/pdf')
  async generatePdf(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const result = await this.service.generatePdf(id, this.getRequesterId(request));
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="constancia-${result.documentNumber}.pdf"`,
    );
    result.pdf.pipe(response);
    result.pdf.end();
  }

  @Public()
  @Get('validate/:id')
  validateDocument(@Param('id') id: string) {
    return this.service.validateDocument(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateEmploymentCertificateStatusDto,
  ) {
    return this.service.updateStatus(id, this.getRequesterId(request), dto);
  }

  private getRequesterId(request: AuthenticatedRequest) {
    return request.user.id || request.user.sub || '';
  }
}
