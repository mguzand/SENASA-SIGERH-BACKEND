import { Module } from '@nestjs/common';
import { AreaManagerService } from './area-manager.service';
import { AreaManagerController } from './area-manager.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaManager } from './entities/area-manager.entity';

@Module({
  controllers: [AreaManagerController],
  providers: [AreaManagerService],
  imports: [TypeOrmModule.forFeature([AreaManager])],
  exports: [AreaManagerService],
})
export class AreaManagerModule {}
