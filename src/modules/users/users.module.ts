import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { RolUserModule } from '../rol-user/rol-user.module';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { Components } from '../components/entities/components.entity';
import { Rol } from '../rol/entities/rol.entity';
import { SystemRole } from '../system/entities/system-role.entity';
import { System } from '../system/entities/system.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Employee,
      EmployeeJobRecord,
      RolUser,
      Components,
      Rol,
      System,
      SystemRole,
    ]),
    RolUserModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
