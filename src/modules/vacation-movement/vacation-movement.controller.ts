import { Controller } from '@nestjs/common';
import { VacationMovementService } from './vacation-movement.service';

@Controller('vacation-movement')
export class VacationMovementController {
  constructor(private readonly vacationMovementService: VacationMovementService) {}
}
