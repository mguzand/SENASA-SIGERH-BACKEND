import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import * as https from 'https';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class RnpService {
  constructor(private readonly httpService: HttpService) {}

  async getDataByDni(dni: string): Promise<any> {
    const url = `https://181.115.16.66:3500/api/${dni}`;
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // ❗️Permite certificados SSL no válidos
    });

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, { httpsAgent }),
      );
      return response.data;
    } catch (error) {
      return null;
    }
  }
}
