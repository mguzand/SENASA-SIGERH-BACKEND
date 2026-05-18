import { Controller, Get, Query } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Public()
  @Get('organizational-unit-types')
  findAllOrganizationalUnitTypes() {
    return this.departmentService.findAllOrganizationalUnitTypes();
  }

  @Public()
  @Get('organizational-units')
  findOrganizationalUnitsByType(@Query('unit_type') unitType: string) {
    return this.departmentService.findOrganizationalUnitsByType(unitType);
  }
}
