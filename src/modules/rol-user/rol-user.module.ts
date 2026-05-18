import { Module } from '@nestjs/common';
import { RolUserService } from './rol-user.service';
import { RolUserController } from './rol-user.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolUser } from './entities/rol-user.entity';

@Module({
  controllers: [RolUserController],
  providers: [RolUserService],
  imports: [
    TypeOrmModule.forFeature([RolUser])
  ],
  exports: [
    RolUserService
  ]
})
export class RolUserModule {}
