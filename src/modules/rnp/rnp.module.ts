import { Module } from '@nestjs/common';
import { RnpServices } from './rnp.service';
import { RnpController } from './rnp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rnp } from './entities/rnp.entity';

@Module({
  controllers: [RnpController],
  providers: [RnpServices],
  imports: [TypeOrmModule.forFeature([Rnp])],
  exports: [RnpServices],
})
export class RnpModule {}
