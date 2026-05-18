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
    type: 'enum',
    enum: AreaManagerRole,
  })
  role: AreaManagerRole;

  @Column({ default: true })
  is_active: boolean;

  @ManyToOne(() => OrganizationalUnit)
  @JoinColumn({ name: 'area_id' })
  area: OrganizationalUnit;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

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
