// vacation-request-detail.entity.ts

import { EmployeeVacationPeriod } from 'src/modules/employee-vacation-period/entities/employee-vacation-period.entity';
import { VacationRequest } from 'src/modules/vacation-request/entities/vacation-request.entity';
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity('vacation_request_details')
export class VacationRequestDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VacationRequest, (request) => request.details, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vacation_request_id' })
  vacationRequest: VacationRequest;

  @Column({ name: 'vacation_request_id' })
  vacationRequestId: string;

  @ManyToOne(() => EmployeeVacationPeriod, (period) => period.requestDetails, {
    nullable: false,
  })
  @JoinColumn({ name: 'vacation_period_id' })
  vacationPeriod: EmployeeVacationPeriod;

  @Column({ name: 'vacation_period_id' })
  vacationPeriodId: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  daysUsed: number;

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
