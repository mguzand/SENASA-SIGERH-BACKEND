import { Module } from '@nestjs/common';
import { VacationRequestDetailService } from './vacation-request-detail.service';
import { VacationRequestDetailController } from './vacation-request-detail.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationRequestDetail } from './entities/vacation-request-detail.entity';

@Module({
  controllers: [VacationRequestDetailController],
  providers: [VacationRequestDetailService],
  imports: [TypeOrmModule.forFeature([VacationRequestDetail])],
  exports: [VacationRequestDetailService],
})
export class VacationRequestDetailModule {}
