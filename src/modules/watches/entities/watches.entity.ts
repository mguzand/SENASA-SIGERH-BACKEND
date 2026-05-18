import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'FingerClient', schema: 'dbo' })
export class FingerClient {
  @PrimaryColumn({ name: 'Clientid', type: 'int' })
  clientId: number;

  @Column({ name: 'ClientName', type: 'varchar', length: 50, nullable: true })
  clientName: string;

  @Column({ name: 'Linkmode', type: 'smallint', default: 1 })
  linkMode: number;

  @Column({ name: 'IPaddress', type: 'varchar', length: 255, nullable: true })
  ipAddress: string;

  @Column({ name: 'ClientNumber', type: 'int', nullable: true, unique: true })
  clientNumber: number;

  @Column({ name: 'Baudrate', type: 'int', nullable: true })
  baudrate: number;

  @Column({ name: 'RecStatus', type: 'int', nullable: true })
  recStatus: number;

  @Column({ name: 'Floorid', type: 'int', nullable: true })
  floorId: number;

  @Column({ name: 'MachineType', type: 'int', nullable: true })
  machineType: number;

  @Column({ name: 'DeviceType', type: 'int', nullable: true })
  deviceType: number;

  @Column({ name: 'CommPWD', type: 'varchar', length: 50, nullable: true })
  commPwd: string;

  @Column({ name: 'CommPort', type: 'int', nullable: true })
  commPort: number;

  @Column({ name: 'deviceflag', type: 'int', nullable: true })
  deviceFlag: number;

  @Column({ name: 'timezone', type: 'varchar', length: 255, nullable: true })
  timezone: string;

  @Column({ name: 'devicesn', type: 'varchar', length: 16, nullable: true })
  deviceSn: string;

  @Column({ name: 'devicefw', type: 'varchar', length: 8, nullable: true })
  deviceFw: string;

  @Column({ name: 'devicememo', type: 'varchar', length: 16, nullable: true })
  deviceMemo: string;

  @Column({ name: 'usercount', type: 'int', nullable: true })
  userCount: number;

  @Column({ name: 'recordcount', type: 'int', nullable: true })
  recordCount: number;

  @Column({ name: 'tmpcount', type: 'int', nullable: true })
  tmpCount: number;

  @Column({ name: 'cardcount', type: 'int', nullable: true })
  cardCount: number;

  @Column({ name: 'passwordcount', type: 'int', nullable: true })
  passwordCount: number;

  @Column({ name: 'linkstatus', type: 'int', nullable: true })
  linkStatus: number;

  @Column({ name: 'topflag', type: 'int', nullable: true })
  topFlag: number;

  @Column({ name: 'toptime', type: 'datetime', nullable: true })
  topTime: Date;

  @Column({ name: 'doorflag', type: 'int', nullable: true })
  doorFlag: number;

  @Column({ name: 'tmpcount2', type: 'int', nullable: true })
  tmpCount2: number;
}
