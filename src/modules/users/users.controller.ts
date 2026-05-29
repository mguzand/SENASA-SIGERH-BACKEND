import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { ListSystemUsersDto } from './dto/list-system-users.dto';
import { UpdateSystemUserPermissionsDto } from './dto/update-system-user-permissions.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('system/:systemId/permissions')
  findSystemUsers(
    @Param('systemId') systemId: string,
    @Query() query: Omit<ListSystemUsersDto, 'systemId'>,
  ) {
    return this.usersService.findSystemUsers({
      systemId,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('system/:systemId/available-employees')
  findAvailableEmployees(
    @Param('systemId') systemId: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAvailableEmployeesForSystem(systemId, search);
  }

  @Get('system/:systemId/catalog')
  getSystemPermissionCatalog(@Param('systemId') systemId: string) {
    return this.usersService.getSystemPermissionCatalog(systemId);
  }

  @Get('system/:systemId/permissions/:userId')
  getSystemUserPermissions(
    @Param('systemId') systemId: string,
    @Param('userId') userId: string,
  ) {
    return this.usersService.getSystemUserPermissions(systemId, userId);
  }

  @Put('system/:systemId/permissions/:userId')
  updateSystemUserPermissions(
    @Param('systemId') systemId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateSystemUserPermissionsDto,
  ) {
    return this.usersService.updateSystemUserPermissions(systemId, userId, dto);
  }

  @Get()
  findAll() {
    return { return: 'This action returns all users' };
  }
}
