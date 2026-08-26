import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RnpModule } from './rnp/rnp.module';
import { StorageService } from './services/storage.service';
import { PrinterService } from './printer/printer.service';
import { RequestHistoryController } from './request-history/request-history.controller';
import { RequestHistoryService } from './request-history/request-history.service';

@Module({
  imports: [RnpModule],
  controllers: [RequestHistoryController],
  providers: [ConfigService, StorageService, PrinterService, RequestHistoryService],
  exports: [ConfigService, RnpModule, StorageService, PrinterService, RequestHistoryService],
})
export class CommonModule {}
