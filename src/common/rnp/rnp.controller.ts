import { Controller, Get, Param } from '@nestjs/common';
import { RnpService } from './rnp.service';
import { Public } from '../decorators/public.decorator';

@Controller('rnp')
export class RnpController {
  constructor(private readonly rnpService: RnpService) {}

  @Public()
  @Get(':dni')
  async getData(@Param('dni') dni: string) {
    return this.rnpService.getDataByDni(dni);
  }
}
