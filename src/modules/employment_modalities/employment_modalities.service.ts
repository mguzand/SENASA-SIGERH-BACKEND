import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmploymentModality } from './entities/employment-modality.entity';

@Injectable()
export class EmploymentModalitiesService {
  constructor(
    @InjectRepository(EmploymentModality)
    private readonly employmentModalityRepository: Repository<EmploymentModality>,
  ) {}

  async findAll() {
    return await this.employmentModalityRepository.find({
      order: { name: 'ASC' },
    });
  }
}
