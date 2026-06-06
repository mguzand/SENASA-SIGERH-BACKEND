import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RnpModule } from './rnp/rnp.module';
import { StorageService } from './services/storage.service';
import { PrinterService } from './printer/printer.service';

@Module({
  imports: [RnpModule],
  providers: [ConfigService, StorageService, PrinterService],
  exports: [ConfigService, RnpModule, StorageService, PrinterService],
})
export class CommonModule {}
