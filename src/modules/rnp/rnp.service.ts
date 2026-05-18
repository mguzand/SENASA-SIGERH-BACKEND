import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rnp } from './entities/rnp.entity';

@Injectable()
export class RnpServices {
  constructor(
    @InjectRepository(Rnp)
    private _Rnp: Repository<Rnp>,
  ) {}

  async getDataByDni(dni: string): Promise<any> {
    const rnpData = await this._Rnp.findOne({
      where: { numeroIdentidad: dni },
    });
    return rnpData;
  }
}
