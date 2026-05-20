import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { PositionService } from './position.service';
import { Public } from 'src/common/decorators/public.decorator';
import { ListPositionDashboardDto } from './dto/list-position-dashboard.dto';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Controller('position')
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  @Public()
  @Get()
  findAll() {
    return this.positionService.findAll();
  }

  @Public()
  @Get('dashboard')
  dashboard(@Query() query: ListPositionDashboardDto) {
    return this.positionService.dashboard(query);
  }

  @Post()
  create(@Body() dto: CreatePositionDto) {
    return this.positionService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePositionDto) {
    return this.positionService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.positionService.remove(id);
  }
}
