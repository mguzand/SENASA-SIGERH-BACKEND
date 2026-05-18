import { Controller } from '@nestjs/common';
import { GovernmentVacationDayService } from './government-vacation-day.service';

@Controller('government-vacation-day')
export class GovernmentVacationDayController {
  constructor(private readonly governmentVacationDayService: GovernmentVacationDayService) {}
}
