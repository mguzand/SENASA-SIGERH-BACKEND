import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { FingerClient } from './entities/watches.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class WatchesService {
  constructor(
    @InjectRepository(FingerClient, 'sqlserver')
    private readonly fingerClientRepository: Repository<FingerClient>,

    @InjectDataSource('sqlserver')
    private readonly sqlServerDataSource: DataSource,
  ) {}

  async getReporteMarcaciones(data: {
    userid: string;
    mes: number;
    anio: number;
    horaEntrada: string;
    horaSalida: string;
  }) {
    const result = await this.sqlServerDataSource.query(
      `
      EXEC dbo.sp_reporte_marcaciones_sigerh
        @Userid = @0,
        @Mes = @1,
        @Anio = @2,
        @HoraEntrada = @3,
        @HoraSalida = @4
      `,
      [data.userid, data.mes, data.anio, data.horaEntrada, data.horaSalida],
    );

    return result;
  }

  async getWatches() {
    return this.fingerClientRepository.find();
  }
}
