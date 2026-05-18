import { Module } from '@nestjs/common';
import { VacationMovementService } from './vacation-movement.service';
import { VacationMovementController } from './vacation-movement.controller';
import { VacationMovement } from './entities/vacation-movement.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  controllers: [VacationMovementController],
  providers: [VacationMovementService],
  imports: [TypeOrmModule.forFeature([VacationMovement])],
  exports: [VacationMovementService],
})
export class VacationMovementModule {}
