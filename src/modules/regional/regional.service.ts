import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Regional } from './entities/regional.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RegionalService {
  constructor(
    @InjectRepository(Regional)
    private readonly regionalRepository: Repository<Regional>,
  ) {}

  async findAll() {
    return await this.regionalRepository.find({
      order: { code: 'ASC' },
    });
  }
}
``;
