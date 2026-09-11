import { Employee } from '../../employees/entities/employee.entity';
import { VacationRequest } from '../../vacation-request/entities/vacation-request.entity';
import { VacationRequestDay } from '../../vacation_request_days/entities/vacation_request_days.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('vacation_request_suspensions')
export class VacationRequestSuspension {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  vacation_request_id: string;

  @ManyToOne(() => VacationRequest, (request) => request.suspensions, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vacation_request_id' })
  vacationRequest: VacationRequest;

  @Column({ type: 'uuid' })
  hr_employee_id: string;

  @ManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hr_employee_id' })
  hrEmployee: Employee;

  @Column({ type: 'date' })
  suspension_date: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  restored_days: number;

  @Column({ type: 'boolean', default: false })
  suspend_all_remaining: boolean;

  @OneToMany(() => VacationRequestDay, (day) => day.suspension)
  days: VacationRequestDay[];

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
