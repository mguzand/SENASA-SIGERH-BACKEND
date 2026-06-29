import { System } from 'src/modules/system/entities/system.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'; 

@Entity('sso_clients')
export class SsoClient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'system_id', type: 'uuid' })
  systemId!: string;

  @ManyToOne(() => System)
  @JoinColumn({ name: 'system_id' })
  system!: System;

  @Column({ name: 'client_id', type: 'varchar', length: 100, unique: true })
  clientId!: string;

  @Column({ name: 'client_secret_hash', type: 'varchar', length: 255 })
  clientSecretHash!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'redirect_uris', type: 'text', array: true })
  redirectUris!: string[];

  @Column({ name: 'is_active', type: 'bool', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}