import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import { DepartmentService } from './department.service';
import { Public } from 'src/common/decorators/public.decorator';
import { AreaHierarchyService } from './area-hierarchy.service';
import { MoveOrganizationalUnitDto } from './dto/move-organizational-unit.dto';

@Controller('department')
export class DepartmentController {
  constructor(
    private readonly departmentService: DepartmentService,
    private readonly hierarchyService: AreaHierarchyService,
  ) {}

  @Get('hierarchy')
  findHierarchy(@Req() req: any) {
    return this.hierarchyService.findHierarchy(req.user?.id);
  }

  @Patch('hierarchy/:id/parent')
  moveArea(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: MoveOrganizationalUnitDto,
    @Req() req: any,
  ) {
    return this.hierarchyService.move(id, dto, req.user?.id);
  }

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
