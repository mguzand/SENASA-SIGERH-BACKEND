import { Controller, Get, Header } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller('.well-known')
export class WellKnownController {
  @Public()
  @Get('assetlinks.json')
  @Header('Content-Type', 'application/json')
  getAssetLinks() {
    return [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'hn.gob.senasa.sigerh',
          sha256_cert_fingerprints: [
            '1C:32:B8:6D:8A:7B:91:06:55:D4:79:E6:12:74:44:20:DC:F3:34:23:44:DA:42:3A:18:A2:75:A7:D8:BB:E0:98',
          ],
        },
      },
    ];
  }
}
