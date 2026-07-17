import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';
import { EmploymentCertificateStatus } from '../enums/employment-certificate-status.enum';
import { EmploymentCertificateType } from '../enums/employment-certificate-type.enum';

@Entity('employment_certificate_requests')
export class EmploymentCertificateRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ type: 'enum', enum: EmploymentCertificateType })
  type: EmploymentCertificateType;

  @Column({
    type: 'enum',
    enum: EmploymentCertificateStatus,
    default: EmploymentCertificateStatus.PENDING,
  })
  status: EmploymentCertificateStatus;

  @Column({ name: 'embassy_name', type: 'varchar', length: 150, nullable: true })
  embassyName: string | null;

  @Column({ name: 'appointment_date', type: 'date', nullable: true })
  appointmentDate: string | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @Column({ name: 'processed_by_employee_id', type: 'uuid', nullable: true })
  processedByEmployeeId: string | null;

  @Column({ name: 'processed_at', type: 'timestamp', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'ready_at', type: 'timestamp', nullable: true })
  readyAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'document_number', type: 'varchar', length: 30, nullable: true })
  documentNumber: string | null;

  @Column({ name: 'generated_at', type: 'timestamp', nullable: true })
  generatedAt: Date | null;

  @Column({ name: 'generated_by_employee_id', type: 'uuid', nullable: true })
  generatedByEmployeeId: string | null;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'processed_by_employee_id' })
  processedByEmployee: Employee | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
