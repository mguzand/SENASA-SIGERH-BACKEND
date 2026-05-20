import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AreaManagerService } from './area-manager.service';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { ListAreaManagersDto } from './dto/list-area-managers.dto';

@Controller('area-manager')
export class AreaManagerController {
  constructor(private readonly areaManagerService: AreaManagerService) {}

  @Get()
  findAll(@Query() query: ListAreaManagersDto) {
    return this.areaManagerService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateAreaManagerDto) {
    return this.areaManagerService.create(dto);
  }
}
