import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SsoClient } from './sso-client.entity';

@Entity('sso_authorization_codes')
export class SsoAuthorizationCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 255 })
  codeHash!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => SsoClient)
  @JoinColumn({ name: 'client_id' })
  client!: SsoClient;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scope!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  state!: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;
}