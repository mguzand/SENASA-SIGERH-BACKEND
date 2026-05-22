import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { EmployeeIntakeController } from './employee-intake.controller';
import { EmployeeIntakeService } from './employee-intake.service';
import { EmployeeIntakeRequest } from './entities/employee-intake.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeIntakeRequest]), CommonModule],
  controllers: [EmployeeIntakeController],
  providers: [EmployeeIntakeService],
})
export class EmployeeIntakeModule {}
