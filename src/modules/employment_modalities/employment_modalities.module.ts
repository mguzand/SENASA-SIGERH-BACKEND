import { Module } from '@nestjs/common';
import { EmploymentModalitiesService } from './employment_modalities.service';
import { EmploymentModalitiesController } from './employment_modalities.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmploymentModality } from './entities/employment-modality.entity';

@Module({
  controllers: [EmploymentModalitiesController],
  providers: [EmploymentModalitiesService],
  imports: [TypeOrmModule.forFeature([EmploymentModality])],
})
export class EmploymentModalitiesModule {}
