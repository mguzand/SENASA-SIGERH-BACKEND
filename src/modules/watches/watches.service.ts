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

  async createManualCheckin(userId: string, date: string, time: string) {
    const checkTime = `${date} ${time.length === 5 ? `${time}:00` : time}`;
    const existing = await this.sqlServerDataSource.query(
      `SELECT TOP 1 Logid FROM dbo.Checkinout WHERE Userid = @0 AND CheckTime = CAST(@1 AS datetime)`,
      [userId, checkTime],
    );
    if (existing.length) return { logId: existing[0].Logid, checkTime, alreadyExists: true };

    const inserted = await this.sqlServerDataSource.query(
      `
      INSERT INTO dbo.Checkinout
        (Userid, CheckTime, CheckType, Sensorid, WorkType, AttFlag, Checked, Exported, OpenDoorFlag, temperature, whynoopen, mask)
      OUTPUT INSERTED.Logid AS logId, INSERTED.CheckTime AS checkTime
      VALUES
        (@0, CAST(@1 AS datetime), 0, 1, 0, 1, 0, 0, 0, 0, 0, 2)
      `,
      [userId, checkTime],
    );
    return { ...inserted[0], alreadyExists: false };
  }
}
