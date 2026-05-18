import { Controller, Get } from '@nestjs/common';
import { RegionalService } from './regional.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('regional')
export class RegionalController {
  constructor(private readonly regionalService: RegionalService) {}

  @Public()
  @Get()
  findAll() {
    return this.regionalService.findAll();
  }
}
