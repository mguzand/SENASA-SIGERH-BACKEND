import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AreaManagerService } from './area-manager.service';
import { CreateAreaManagerDto } from './dto/create-area-manager.dto';
import { ListAreaManagersDto } from './dto/list-area-managers.dto';
import { CheckAreaManagerAccessDto } from './dto/check-area-manager-access.dto';
import { RegionalManagerService } from './regional-manager.service';
import { CreateRegionalManagerDto } from './dto/create-regional-manager.dto';
import { UpdateHrLiaisonPermissionsDto } from './dto/update-hr-liaison-permissions.dto';
import { AssignLeaveFinalApproverDto } from './dto/assign-leave-final-approver.dto';
import { UpdateRegionalManagerSignatureDto } from './dto/update-regional-manager-signature.dto';

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

  @Get('leave-final-approver')
  getLeaveFinalApprover() {
    return this.regionalManagerService.getLeaveFinalApprover();
  }

  @Post('leave-final-approver')
  assignLeaveFinalApprover(@Body() dto: AssignLeaveFinalApproverDto) {
    return this.regionalManagerService.assignLeaveFinalApprover(
      dto.employee_id,
    );
  }

  @Post('regional')
  createRegionalManager(@Body() dto: CreateRegionalManagerDto) {
    return this.regionalManagerService.create(dto);
  }

  @Get('regional/hr-liaisons')
  findRegionalHrLiaisons() {
    return this.regionalManagerService.findHrLiaisons();
  }

  @Post('regional/hr-liaisons')
  createRegionalHrLiaison(@Body() dto: CreateRegionalManagerDto) {
    return this.regionalManagerService.createHrLiaison(dto);
  }

  @Patch('regional/hr-liaisons/:id/deactivate')
  deactivateRegionalHrLiaison(@Param('id') id: string) {
    return this.regionalManagerService.deactivateHrLiaison(id);
  }

  @Patch('regional/hr-liaisons/:id/permissions')
  updateRegionalHrLiaisonPermissions(
    @Param('id') id: string,
    @Body() dto: UpdateHrLiaisonPermissionsDto,
  ) {
    return this.regionalManagerService.updateHrLiaisonPermissions(id, dto);
  }

  @Get('regional/hr-liaisons/access/:employeeId')
  getRegionalHrLiaisonAccess(@Param('employeeId') employeeId: string) {
    return this.regionalManagerService.getHrLiaisonAccess(employeeId);
  }

  @Patch('regional/:id/signature')
  updateRegionalSignature(
    @Param('id') id: string,
    @Body() dto: UpdateRegionalManagerSignatureDto,
  ) {
    return this.regionalManagerService.updateSignature(id, dto);
  }

  @Get('regional/:id/signature')
  async getRegionalSignature(@Param('id') id: string, @Res() response: Response) {
    const signature = await this.regionalManagerService.getSignature(id);
    response.type(signature.mimeType);
    response.setHeader('Cache-Control', 'private, no-store');
    return response.sendFile(signature.absolutePath);
  }
}
