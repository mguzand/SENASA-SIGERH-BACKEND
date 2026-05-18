import { Controller, Get, Param, Query } from '@nestjs/common';
import { WatchesService } from './watches.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('watches')
export class WatchesController {
  constructor(private readonly watchesService: WatchesService) {}

  @Public()
  @Get()
  getWatches() {
    return this.watchesService.getWatches();
  }

  @Public()
  @Get('reporte-marcaciones')
  getReporteMarcaciones(
    @Query('userid') userid: string,
    @Query('mes') mes: string,
    @Query('anio') anio: string,
    @Query('horaEntrada') horaEntrada: string,
    @Query('horaSalida') horaSalida: string,
  ) {
    return this.watchesService.getReporteMarcaciones({
      userid,
      mes: Number(mes),
      anio: Number(anio),
      horaEntrada,
      horaSalida,
    });
  }
}
