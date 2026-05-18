import { Module } from '@nestjs/common';
import { AcademicHistoryService } from './academic-history.service';
import { AcademicHistoryController } from './academic-history.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicHistory } from './entities/academic-history.entity';

@Module({
  controllers: [AcademicHistoryController],
  providers: [AcademicHistoryService],
  imports: [TypeOrmModule.forFeature([AcademicHistory])],
  exports: [AcademicHistoryService],
})
export class AcademicHistoryModule {}
