import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { RolUserService } from './rol-user.service';
import { CreateRolUserModuleDto } from './dto/create-rol-module.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('rol-user')
export class RolUserController {
  constructor(private readonly rolUserService: RolUserService) {}

  @Public()
  @Get(':id_user/:system')
  findOnetest(
    @Param('id_user') id_user: string,
    @Param('system') system: string,
  ) {
    return this.rolUserService.getAllByUser(id_user, system);
  }

  @Post()
  create(@Body() _createRolUserModuleDto: CreateRolUserModuleDto) {
    return this.rolUserService.create(_createRolUserModuleDto);
  }
}
