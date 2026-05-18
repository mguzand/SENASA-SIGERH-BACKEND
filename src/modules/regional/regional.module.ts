import { Module } from '@nestjs/common';
import { RegionalService } from './regional.service';
import { RegionalController } from './regional.controller';
import { Regional } from './entities/regional.entity';
import { TypeOrmModule } from '@nestjs/typeorm/dist/typeorm.module';

@Module({
  controllers: [RegionalController],
  providers: [RegionalService],
  imports: [TypeOrmModule.forFeature([Regional])],
})
export class RegionalModule {}
