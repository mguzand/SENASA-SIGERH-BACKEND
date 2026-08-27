import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PushDevice } from './entities/push-device.entity';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import { isAbsolute, resolve } from 'path';

@Injectable()
export class PushNotificationsService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationsService.name);
  private ready = false;
  constructor(
    @InjectRepository(PushDevice) private readonly devices: Repository<PushDevice>,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (!configuredPath) return this.logger.warn('Firebase Push deshabilitado: falta FIREBASE_SERVICE_ACCOUNT_PATH');
    try {
      const path = isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath);
      const account = JSON.parse(readFileSync(path, 'utf8'));
      if (!getApps().length) initializeApp({ credential: cert(account) });
      this.ready = true;
      this.logger.log('Firebase Push inicializado');
    } catch (error) {
      this.logger.error(`No se pudo inicializar Firebase Push: ${error instanceof Error ? error.message : error}`);
    }
  }

  async register(userId: string, token: string, platform: string) {
    let device = await this.devices.findOne({ where: { token } });
    device = this.devices.create({ ...device, userId, token, platform, isActive: true });
    return this.devices.save(device);
  }

  async sendToEmployee(employeeId: string | null | undefined, title: string, body: string, url: string) {
    if (!this.ready || !employeeId) return;
    const rows = await this.dataSource.query(
      `SELECT d.id, d.token FROM push_devices d INNER JOIN users u ON u.id = d.user_id
       WHERE u.employee_id = $1 AND d.is_active = true`,
      [employeeId],
    );
    if (!rows.length) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens: rows.map((row: any) => row.token),
      notification: { title, body },
      data: { url },
      android: { priority: 'high', notification: { channelId: 'requests' } },
      apns: { payload: { aps: { sound: 'default' } } },
    });
    const invalidIds = rows
      .filter((_: any, index: number) => {
        const code = response.responses[index]?.error?.code || '';
        return code.includes('registration-token-not-registered') || code.includes('invalid-registration-token');
      })
      .map((row: any) => row.id);
    if (invalidIds.length) await this.devices.update({ id: In(invalidIds) }, { isActive: false });
  }
}
