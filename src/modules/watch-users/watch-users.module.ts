import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchUser } from './entities/watch-user.entity';
import { WatchUsersController } from './watch-users.controller';
import { WatchUsersService } from './watch-users.service';
import { Employee } from '../employees/entities/employee.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WatchUser], 'sqlserver'),
    TypeOrmModule.forFeature([Employee]),
  ],
  controllers: [WatchUsersController],
  providers: [WatchUsersService],
  exports: [WatchUsersService],
})
export class WatchUsersModule {}
