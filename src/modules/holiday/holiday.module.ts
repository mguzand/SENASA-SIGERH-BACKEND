import { Module, OnModuleInit } from '@nestjs/common';
import { HolidayService } from './holiday.service';
import { HolidayController } from './holiday.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Holiday } from './entities/holiday.entity';
import { Components } from '../components/entities/components.entity';

@Module({
  controllers: [HolidayController],
  providers: [HolidayService],
  imports: [TypeOrmModule.forFeature([Holiday, Components])],
})
export class HolidayModule implements OnModuleInit {
  constructor(private readonly holidayService: HolidayService) {}

  async onModuleInit() {
    await this.holidayService.ensurePermissionComponent();
  }
}
