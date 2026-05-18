import { Injectable } from '@nestjs/common';
import { AreaManagerRole } from './interfaces/area-manager-role.enum';
import { AreaManager } from './entities/area-manager.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AreaManagerService {
  constructor(
    @InjectRepository(AreaManager)
    private readonly areaManagerRepository: Repository<AreaManager>,
  ) {}

  async findActiveManagerByAreaAndRole(
    areaId: string,
    role: AreaManagerRole,
  ): Promise<AreaManager | null> {
    return this.areaManagerRepository.findOne({
      where: {
        area_id: areaId,
        role,
        is_active: true,
      },
    });
  }
}
