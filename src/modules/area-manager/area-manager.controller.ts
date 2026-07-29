import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AreaManagerService } from './area-manager.service';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { ListAreaManagersDto } from './dto/list-area-managers.dto';
import { CheckAreaManagerAccessDto } from './dto/check-area-manager-access.dto';
import { RegionalManagerService } from './regional-manager.service';
import { CreateRegionalManagerDto } from './dto/create-regional-manager.dto';

@Controller('area-manager')
export class AreaManagerController {
  constructor(
    private readonly areaManagerService: AreaManagerService,
    private readonly regionalManagerService: RegionalManagerService,
  ) {}

  @Get()
  findAll(@Query() query: ListAreaManagersDto) {
    return this.areaManagerService.findAll(query);
  }

  @Get('access')
  checkAccess(@Query() query: CheckAreaManagerAccessDto) {
    return this.areaManagerService.checkEmployeeAccess(
      query.areaId,
      query.employeeId,
    );
  }

  @Post()
  create(@Body() dto: CreateAreaManagerDto) {
    return this.areaManagerService.create(dto);
  }

  @Get('regional')
  findRegionalManagers() {
    return this.regionalManagerService.findAll();
  }

  @Post('regional')
  createRegionalManager(@Body() dto: CreateRegionalManagerDto) {
    return this.regionalManagerService.create(dto);
  }
}
