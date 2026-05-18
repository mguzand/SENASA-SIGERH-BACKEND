// src/modules/vacations/cron/vacation-period.cron.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EmployeeVacationPeriodService } from '../employee-vacation-period.service';

@Injectable()
export class VacationPeriodCron {
  private readonly logger = new Logger(VacationPeriodCron.name);

  constructor(
    private readonly vacationsService: EmployeeVacationPeriodService,
  ) {}

  /**
   * Todos los días a las 12:05 AM
   */
  @Cron('0 6 * * *')
  async handleVacationPeriods() {
    this.logger.log('Iniciando proceso automático de vacaciones');

    try {
      await this.vacationsService.processVacationPeriods();

      this.logger.log('✅ Proceso de vacaciones finalizado');
    } catch (error) {
      this.logger.error('Error ejecutando proceso de vacaciones', error.stack);
    }
  }
}
