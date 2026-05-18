// vacation-request-adjustment.entity.ts

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
import { VacationRequest } from './vacation-request.entity';
import { VacationAdjustmentType } from 'src/common/enums/vacation.enums';

@Entity('vacation_request_adjustments')
export class VacationRequestAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VacationRequest, (request) => request.adjustments, {
    nullable: false,
  })
  @JoinColumn({ name: 'vacation_request_id' })
  vacationRequest: VacationRequest;

  @Column({ name: 'vacation_request_id' })
  vacationRequestId: string;

  @Column({
    type: 'enum',
    enum: VacationAdjustmentType,
  })
  adjustmentType: VacationAdjustmentType;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  originalDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  adjustedDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  differenceDays: number;

  @Column({ type: 'date' })
  adjustmentDate: string;

  @Column({ type: 'text' })
  reason: string;

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
