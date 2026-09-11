import { Body, Controller, Get, Param, Patch, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { GovernmentVacationDayService } from './government-vacation-day.service';
import { CreateGovernmentVacationDayDto } from './dto/create-government-vacation-day.dto';
import { UpdateGovernmentVacationExclusionsDto } from './dto/update-government-vacation-exclusions.dto';

@Controller('government-vacation-days')
export class GovernmentVacationDayController {
  constructor(private readonly governmentVacationDayService: GovernmentVacationDayService) {}

  @Get()
  findAll() {
    return this.governmentVacationDayService.findAll();
  }

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Body() dto: CreateGovernmentVacationDayDto, @Req() req: any) {
    return this.governmentVacationDayService.createAndProcess(dto, req.user?.id ?? null);
  }

  @Get(':id/exclusions')
  exclusions(@Param('id') id: string) {
    return this.governmentVacationDayService.findExclusions(id);
  }

  @Patch(':id/exclusions')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  updateExclusions(
    @Param('id') id: string,
    @Body() dto: UpdateGovernmentVacationExclusionsDto,
    @Req() req: any,
  ) {
    return this.governmentVacationDayService.updateExclusions(
      id,
      dto.excludedEmployeeIds,
      req.user?.id ?? null,
    );
  }
}
