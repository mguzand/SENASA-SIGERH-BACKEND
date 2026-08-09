import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { EmployeeVacationPeriod } from '../../employee-vacation-period/entities/employee-vacation-period.entity';
import { LeaveRequest } from './leave-request.entity';

@Entity('leave_vacation_impacts')
export class LeaveVacationImpact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'leave_request_id', type: 'uuid' })
  leaveRequestId: string;

  @ManyToOne(() => LeaveRequest, (request) => request.vacationImpacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'leave_request_id' })
  leaveRequest: LeaveRequest;

  @Column({ name: 'vacation_period_id', type: 'uuid' })
  vacationPeriodId: string;

  @ManyToOne(() => EmployeeVacationPeriod)
  @JoinColumn({ name: 'vacation_period_id' })
  vacationPeriod: EmployeeVacationPeriod;

  @Column({ name: 'old_end_date', type: 'date' })
  oldEndDate: string;

  @Column({ name: 'new_end_date', type: 'date' })
  newEndDate: string;

  @Column({ name: 'old_accreditation_date', type: 'date' })
  oldAccreditationDate: string;

  @Column({ name: 'new_accreditation_date', type: 'date' })
  newAccreditationDate: string;

  @Column({ name: 'shift_days', type: 'int' })
  shiftDays: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
