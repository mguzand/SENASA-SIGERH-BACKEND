import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('exit_permit_retroactive_authorizations')
export class ExitPermitRetroactiveAuthorization {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'employee_id', type: 'uuid' }) employeeId: string;
  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' }) employee: Employee;

  @Column({ name: 'authorized_by_employee_id', type: 'uuid' }) authorizedByEmployeeId: string;
  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authorized_by_employee_id' }) authorizedByEmployee: Employee;

  @Column({ name: 'start_date', type: 'date' }) startDate: string;
  @Column({ name: 'end_date', type: 'date' }) endDate: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
