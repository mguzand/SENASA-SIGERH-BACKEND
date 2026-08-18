import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ListWatchUsersDto } from './dto/list-watch-users.dto';
import { WatchUsersService } from './watch-users.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('watch-users')
export class WatchUsersController {
  constructor(private readonly service: WatchUsersService) {}

  @Get()
  findAll(@Query() filters: ListWatchUsersDto) {
    return this.service.findAll(filters);
  }
  
  @Public()
  @Post('migrate-employees')
  migrateEmployees() {
    return this.service.migrateActiveEmployees();
  }

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.service.findOne(userId);
  }
}
