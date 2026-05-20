import { Module } from '@nestjs/common';
import { AreaManagerService } from './area-manager.service';
import { AreaManagerController } from './area-manager.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaManager } from './entities/area-manager.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [AreaManagerController],
  providers: [AreaManagerService],
  imports: [TypeOrmModule.forFeature([AreaManager]), CommonModule],
  exports: [AreaManagerService],
})
export class AreaManagerModule {}
