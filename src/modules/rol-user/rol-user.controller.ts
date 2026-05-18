import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { RolUserService } from './rol-user.service';
import { CreateRolUserModuleDto } from './dto/create-rol-module.dto';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('rol-user')
export class RolUserController {
  constructor(private readonly rolUserService: RolUserService) {}
 

  @Public()
  @Get(':id_user')
      findOnetest(
         @Param('id_user', ParseIntPipe) id_user: number,
      ) {
      return this.rolUserService.getAllByUser(id_user);
  }

  @Post()
  create(@Body() _createRolUserModuleDto: CreateRolUserModuleDto){
    return this.rolUserService.create(_createRolUserModuleDto);
  }


  
}
