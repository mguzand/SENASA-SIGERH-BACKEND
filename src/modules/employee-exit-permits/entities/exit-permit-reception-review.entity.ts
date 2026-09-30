import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeeExitPermit } from './employee-exit-permit.entity';

@Entity('exit_permit_reception_reviews')
export class ExitPermitReceptionReview {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'exit_permit_id', type: 'uuid', unique: true })
  exitPermitId: string;

  @OneToOne(() => EmployeeExitPermit, (permit) => permit.receptionReview, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exit_permit_id' })
  exitPermit: EmployeeExitPermit;

  @Column({ name: 'reviewed_by_employee_id', type: 'uuid' })
  reviewedByEmployeeId: string;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'reviewed_by_employee_id' })
  reviewedBy: Employee;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp' })
  reviewedAt: Date;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
