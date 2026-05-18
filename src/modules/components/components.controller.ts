import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ComponentsService } from './components.service';

@Controller('components')
export class ComponentsController {
  constructor(private readonly componentsService: ComponentsService) {}



  @Get(":userId")
  findAll(
    @Param("userId", ParseIntPipe) userId : number,
  ) {
    return this.componentsService.findAll(userId);
  }

 


}
