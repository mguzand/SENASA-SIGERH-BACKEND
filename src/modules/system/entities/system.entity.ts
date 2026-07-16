import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Components } from 'src/modules/components/entities/components.entity';
import { SystemRole } from './system-role.entity';

@Entity('systems', { synchronize: true })
export class System {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 150 })
  description: string;

  @OneToMany(() => Components, (component) => component.system)
  components: Components[];

  @OneToMany(() => SystemRole, (role) => role.system)
  roles: SystemRole[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
