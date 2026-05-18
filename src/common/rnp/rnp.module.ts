import { Module } from '@nestjs/common';
import { RnpService } from './rnp.service';
import { RnpController } from './rnp.controller';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  controllers: [RnpController],
  providers: [RnpService],
  exports: [RnpService]
})
export class RnpModule {}
