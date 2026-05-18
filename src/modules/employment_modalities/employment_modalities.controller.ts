import { Controller, Get } from '@nestjs/common';
import { EmploymentModalitiesService } from './employment_modalities.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('employment-modalities')
export class EmploymentModalitiesController {
  constructor(
    private readonly employmentModalitiesService: EmploymentModalitiesService,
  ) {}

  @Public()
  @Get()
  findAll() {
    return this.employmentModalitiesService.findAll();
  }
}
