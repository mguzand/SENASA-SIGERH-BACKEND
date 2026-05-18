import { EmployeeJobRecord } from 'src/modules/employee-job-record/entities/employee-job-record.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { OrganizationalUnitType } from './organizational_unit_types';

@Entity('organizational_units')
export class OrganizationalUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'uuid' })
  unit_type: string;
  // Ejemplo: DIRECTION, DEPARTMENT, UNIT, REGIONAL_OFFICE, MANAGEMENT, SECRETARIAT, AUDIT

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ default: false })
  is_main_office: boolean;

  @ManyToOne(() => OrganizationalUnit, (unit) => unit.children, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: OrganizationalUnit;

  @OneToMany(() => OrganizationalUnit, (unit) => unit.parent)
  children: OrganizationalUnit[];

  @OneToMany(
    () => EmployeeJobRecord,
    (employeeJobRecord) => employeeJobRecord.area,
  )
  employeeJobRecord: EmployeeJobRecord[];

  @ManyToOne(() => OrganizationalUnitType, (unitType) => unitType.units)
  @JoinColumn({ name: 'unit_type' })
  unitType: OrganizationalUnitType;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  created_at?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  updated_at?: Date;

  //------------------ Enter date by default when creating insert ------------------//
  @BeforeInsert()
  setDefaultDates() {
    const date = new Date();
    this.created_at = date;
    this.updated_at = date;
  }

  //---------------- Update date by default when creating insert ----------------//
  @BeforeUpdate()
  setDefaultDate() {
    this.updated_at = new Date();
  }
}
