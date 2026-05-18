import { Controller } from '@nestjs/common';
import { AcademicHistoryService } from './academic-history.service';

@Controller('academic-history')
export class AcademicHistoryController {
  constructor(private readonly academicHistoryService: AcademicHistoryService) {}
}
