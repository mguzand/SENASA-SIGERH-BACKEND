import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AreaManagerService } from '../area-manager.service';

@Injectable()
export class AreaManagerCron {
  private readonly logger = new Logger(AreaManagerCron.name);

  constructor(private readonly areaManagerService: AreaManagerService) {}

  @Cron('0 3 * * *', {
    timeZone: 'America/Tegucigalpa',
  })
  async restoreExpiredDelegations() {
    this.logger.log('Iniciando restauración automática de delegaciones vencidas');

    try {
      const restored = await this.areaManagerService.processExpiredDelegations();
      this.logger.log(
        `Proceso finalizado. Delegaciones procesadas: ${restored}`,
      );
    } catch (error) {
      this.logger.error(
        'Error ejecutando restauración automática de delegaciones',
        error?.stack,
      );
    }
  }
}
