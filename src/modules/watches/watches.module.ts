import { Module } from '@nestjs/common';
import { WatchesService } from './watches.service';
import { WatchesController } from './watches.controller';
import { FingerClient } from './entities/watches.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';

@Module({
  imports: [TypeOrmModule.forFeature([FingerClient], 'sqlserver')],
  controllers: [WatchesController],
  providers: [WatchesService],
})
export class WatchesModule {}
