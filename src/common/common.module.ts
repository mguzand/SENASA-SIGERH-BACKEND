import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RnpModule } from './rnp/rnp.module';
import { StorageService } from './services/storage.service';

@Module({
  imports: [RnpModule],
  providers: [ConfigService, StorageService],
  exports: [ConfigService, RnpModule, StorageService],
})
export class CommonModule {}
