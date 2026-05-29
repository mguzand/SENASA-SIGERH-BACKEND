import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { System } from './entities/system.entity';

@Module({
  imports: [TypeOrmModule.forFeature([System])],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
