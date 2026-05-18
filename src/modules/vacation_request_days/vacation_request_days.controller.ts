import { Controller } from '@nestjs/common';
import { VacationRequestDayService } from './vacation_request_days.service';

@Controller('vacation-request-days')
export class VacationRequestDaysController {
  constructor(
    private readonly vacationRequestDaysService: VacationRequestDayService,
  ) {}
}
