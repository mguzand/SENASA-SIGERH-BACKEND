import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';
import { GovernmentVacationDay } from '../../government-vacation-day/entities/government-vacation-day.entity';

@Entity('employee_government_vacation_exclusions')
export class EmployeeGovernmentVacationExclusion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => GovernmentVacationDay, { nullable: false })
  @JoinColumn({ name: 'government_vacation_day_id' })
  governmentVacationDay: GovernmentVacationDay;

  @Column({ name: 'government_vacation_day_id' })
  governmentVacationDayId: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ nullable: true, type: 'uuid' })
  createdByUserId: string | null;

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
