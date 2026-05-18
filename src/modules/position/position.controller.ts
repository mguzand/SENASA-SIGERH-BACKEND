import { Controller, Get } from '@nestjs/common';
import { PositionService } from './position.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('position')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  @Public()
  @Get()
  findAll() {
    return this.positionService.findAll();
  }
}
