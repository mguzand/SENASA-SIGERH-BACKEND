import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { UpdateDocumentExpirationDto } from './dto/update-document-expiration.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('expired-documents')
  getExpiredDocuments(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('view') view?: string,
    @Query('updatedFrom') updatedFrom?: string,
    @Query('updatedTo') updatedTo?: string,
  ) {
    return this.dashboardService.getExpiredDocuments({
      search,
      page,
      limit,
      view,
      updatedFrom,
      updatedTo,
    });
  }

  @Patch('expired-documents/:documentId/expiration-date')
  updateDocumentExpirationDate(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentExpirationDto,
  ) {
    return this.dashboardService.updateCriminalRecordExpirationDate(
      documentId,
      dto.expirationDate,
    );
  }
}
