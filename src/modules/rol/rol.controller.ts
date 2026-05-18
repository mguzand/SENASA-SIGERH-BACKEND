import { Controller, Get } from '@nestjs/common';
import { RolService } from './rol.service';

@Controller('rols')
export class RolController {
  constructor(private readonly rolService: RolService) {}


  @Get()
  findAll() {
    return this.rolService.findAll();
  }

  
}
