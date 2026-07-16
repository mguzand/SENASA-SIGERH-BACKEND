import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { RolUser } from '../../rol-user/entities/rol-user.entity';
import { System } from './system.entity';

@Entity('system_roles', { synchronize: true })
@Unique('UQ_system_roles_system_code', ['systemId', 'code'])
export class SystemRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'system_id', type: 'uuid' })
  systemId: string;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  description: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'smallint', nullable: true })
  order: number | null;

  @ManyToOne(() => System, (system) => system.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'system_id' })
  system: System;

  @OneToMany(() => RolUser, (permission) => permission.systemRole)
  permissions: RolUser[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
