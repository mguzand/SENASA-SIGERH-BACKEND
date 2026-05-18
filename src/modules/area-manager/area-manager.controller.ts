import { Controller } from '@nestjs/common';
import { AreaManagerService } from './area-manager.service';

@Controller('area-manager')
export class AreaManagerController {
  constructor(private readonly areaManagerService: AreaManagerService) {}
}
