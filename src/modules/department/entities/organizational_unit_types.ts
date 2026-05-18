import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { OrganizationalUnit } from './organizational-unit.entity';

@Entity('organizational_unit_types')
export class OrganizationalUnitType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => OrganizationalUnit, (units) => units.unitType)
  units: OrganizationalUnit[];
}
