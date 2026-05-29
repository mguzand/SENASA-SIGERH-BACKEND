import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

import { RolUser } from 'src/modules/rol-user/entities/rol-user.entity';
import { System } from 'src/modules/system/entities/system.entity';

//↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
//      Entity roles sincronizar en falso para impedir sincronizacion con el shema      //
//↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
@Entity('components', { synchronize: true })
export class Components {
  @PrimaryGeneratedColumn({ type: 'smallint' })
  components_id: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  description: string;

  @Column({ type: 'int2', nullable: true })
  orden: number;

  @Column({ type: 'boolean', default: true })
  visible: boolean;

  @Column({ type: 'uuid', nullable: true })
  system_id: string | null;

  @ManyToOne(() => System, (system) => system.components, {
    nullable: true,
  })
  @JoinColumn({ name: 'system_id' })
  system: System | null;

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                         RELATION TO THE TABLE ROLES Users Module                     //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  @OneToMany(() => RolUser, (rolUser) => rolUser.components)
  rolUser: RolUser[];
}
