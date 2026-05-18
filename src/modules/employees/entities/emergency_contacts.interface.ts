import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from './employee.entity';

@Entity('employee_emergency_contacts')
export class EmployeeEmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true, name: 'employee_id' })
  employeeId: string;

  @OneToOne(() => Employee, (employee) => employee.emergencyContact, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ length: 150 })
  emergency_contact_name: string;

  @Column({ length: 100 })
  emergency_contact_relationship: string;

  @Column({ length: 30 })
  emergency_contact_phone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
