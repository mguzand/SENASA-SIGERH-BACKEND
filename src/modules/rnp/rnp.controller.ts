import { Controller } from '@nestjs/common';
import { RnpServices } from './rnp.service';

@Controller('rnp')
export class RnpController {
  constructor(private readonly rnpService: RnpServices) {}
}
