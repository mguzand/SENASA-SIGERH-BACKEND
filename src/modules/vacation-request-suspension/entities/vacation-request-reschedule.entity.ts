import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { VacationRequest } from '../../vacation-request/entities/vacation-request.entity';

@Entity('vacation_request_reschedules')
export class VacationRequestReschedule {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) vacation_request_id: string;
  @ManyToOne(() => VacationRequest, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vacation_request_id' }) vacationRequest: VacationRequest;
  @Column({ type: 'uuid' }) hr_employee_id: string;
  @ManyToOne(() => Employee, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hr_employee_id' }) hrEmployee: Employee;
  @Column({ type: 'jsonb' }) original_days: string[];
  @Column({ type: 'jsonb' }) new_days: string[];
  @Column({ type: 'text' }) reason: string;
  @CreateDateColumn({ type: 'timestamp' }) created_at: Date;
}
