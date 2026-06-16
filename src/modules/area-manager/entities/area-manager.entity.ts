import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AreaManagerRole } from '../interfaces/area-manager-role.enum';
import { OrganizationalUnit } from 'src/modules/department/entities/organizational-unit.entity';
import { Employee } from 'src/modules/employees/entities/employee.entity';

@Entity('area_managers')
export class AreaManager {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  area_id: string;

  @Column('uuid')
  employee_id: string;

  @Column({
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  url_document: string | null;

  @Column({
    type: 'enum',
    enum: AreaManagerRole,
  })
  role: AreaManagerRole;

  @Column({ default: false })
  is_a_delegate: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'date', nullable: true })
  delegation_end_date: Date | null;

  @Column({ type: 'uuid', nullable: true })
  suspended_boss_id: string | null;

  @ManyToOne(() => OrganizationalUnit)
  @JoinColumn({ name: 'area_id' })
  area: OrganizationalUnit;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => AreaManager, { nullable: true })
  @JoinColumn({ name: 'suspended_boss_id' })
  suspendedBoss: AreaManager | null;

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
