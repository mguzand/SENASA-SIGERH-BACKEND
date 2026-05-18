// vacation-movement.entity.ts

import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeeVacationPeriod } from 'src/modules/employee-vacation-period/entities/employee-vacation-period.entity';
import { VacationRequest } from 'src/modules/vacation-request/entities/vacation-request.entity';
import { VacationMovementType } from 'src/common/enums/vacation.enums';

@Entity('vacation_movements')
export class VacationMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => EmployeeVacationPeriod, (period) => period.movements, {
    nullable: true,
  })
  @JoinColumn({ name: 'vacation_period_id' })
  vacationPeriod: EmployeeVacationPeriod | null;

  @Column({ name: 'vacation_period_id', nullable: true })
  vacationPeriodId: string | null;

  @ManyToOne(() => VacationRequest, { nullable: true })
  @JoinColumn({ name: 'vacation_request_id' })
  vacationRequest: VacationRequest | null;

  @Column({ name: 'vacation_request_id', nullable: true })
  vacationRequestId: string | null;

  @Column({
    type: 'enum',
    enum: VacationMovementType,
  })
  type: VacationMovementType;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  days: number;

  @Column({ type: 'date' })
  movementDate: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

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
