import { Controller, Get } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Public()
  @Get()
  findAll() {
    return this.schedulesService.findAll();
  }
}
