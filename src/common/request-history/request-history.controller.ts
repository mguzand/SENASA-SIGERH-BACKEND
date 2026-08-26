import { Controller, Get, Param } from '@nestjs/common';
import { RequestHistoryService } from './request-history.service';

@Controller('request-history')
export class RequestHistoryController {
  constructor(private readonly service: RequestHistoryService) {}

  @Get(':type/:id')
  find(
    @Param('type') type: 'exit-permit' | 'vacation' | 'certificate' | 'leave',
    @Param('id') id: string,
  ) {
    return this.service.find(type, id);
  }
}
