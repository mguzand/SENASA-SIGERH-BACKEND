import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { ListSystemUsersDto } from './dto/list-system-users.dto';
import { UpdateSystemUserPermissionsDto } from './dto/update-system-user-permissions.dto';
import type { AuthenticatedRequest } from 'src/common/auth/interfaces/authenticated-request.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('manageable-systems')
  getManageableSystems(@Req() request: AuthenticatedRequest) {
    return this.usersService.getManageableSystems(
      this.getRequesterId(request),
    );
  }

  @Get('system/:systemId/permissions')
  async findSystemUsers(
    @Param('systemId') systemId: string,
    @Query() query: Omit<ListSystemUsersDto, 'systemId'>,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.usersService.assertCanManageSystem(
      this.getRequesterId(request),
      systemId,
    );
    return this.usersService.findSystemUsers({
      systemId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('system/:systemId/available-employees')
  async findAvailableEmployees(
    @Param('systemId') systemId: string,
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
  ) {
    await this.usersService.assertCanManageSystem(
      this.getRequesterId(request),
      systemId,
    );
    return this.usersService.findAvailableEmployeesForSystem(systemId, search);
  }

  @Get('system/:systemId/catalog')
  async getSystemPermissionCatalog(
    @Param('systemId') systemId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.usersService.assertCanManageSystem(
      this.getRequesterId(request),
      systemId,
    );
    return this.usersService.getSystemPermissionCatalog(systemId);
  }

  @Get('system/:systemId/permissions/:userId')
  async getSystemUserPermissions(
    @Param('systemId') systemId: string,
    @Param('userId') userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.usersService.assertCanManageSystem(
      this.getRequesterId(request),
      systemId,
    );
    return this.usersService.getSystemUserPermissions(systemId, userId);
  }

  @Put('system/:systemId/permissions/:userId')
  async updateSystemUserPermissions(
    @Param('systemId') systemId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateSystemUserPermissionsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.usersService.assertCanManageSystem(
      this.getRequesterId(request),
      systemId,
    );
    return this.usersService.updateSystemUserPermissions(systemId, userId, dto);
  }

  @Get()
  findAll() {
    return { return: 'This action returns all users' };
  }

  private getRequesterId(request: AuthenticatedRequest) {
    return request.user.id || request.user.sub || '';
  }
}
