import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Public } from 'src/common/decorators/public.decorator';
import { CreateEmployeeDto } from './dtos/create-employees.dto';
import { UpdateEmployeeEditableDto } from './dtos/update-employee-editable.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.employeesService.findAll({
      search,
      departmentId,
      status,
      page,
      limit,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.employeesService.findOne(id);
  }

  @Post()
  create(@Body() createEmployeeDto: CreateEmployeeDto, @Req() req: any) {
    return this.employeesService.create(createEmployeeDto, req.user);
  }

  @Patch(':id/editable-data')
  updateEditableData(@Param('id') id: string, @Body() dto: UpdateEmployeeEditableDto) {
    return this.employeesService.updateEditableData(id, dto);
  }

  @Public()
  @Get('status/:id')
  getPersonByIdentity(@Param('id') id: string) {
    return this.employeesService.getPersonByIdentity(id);
  }
}
