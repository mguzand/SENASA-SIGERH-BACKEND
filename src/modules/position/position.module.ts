import { Module } from '@nestjs/common';
import { PositionService } from './position.service';
import { PositionController } from './position.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from './entities/position.entity';

@Module({
  controllers: [PositionController],
  providers: [PositionService],
  imports: [TypeOrmModule.forFeature([Position])],
})
export class PositionModule {}
