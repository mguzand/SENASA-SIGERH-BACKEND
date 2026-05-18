import { Controller } from '@nestjs/common';
import { VacationRequestDetailService } from './vacation-request-detail.service';

@Controller('vacation-request-detail')
export class VacationRequestDetailController {
  constructor(private readonly vacationRequestDetailService: VacationRequestDetailService) {}
}
