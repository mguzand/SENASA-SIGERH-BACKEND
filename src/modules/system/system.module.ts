import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { System } from './entities/system.entity';
import { SystemRole } from './entities/system-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([System, SystemRole])],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
