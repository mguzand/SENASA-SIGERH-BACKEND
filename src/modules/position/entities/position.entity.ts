import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { EmployeeJobRecord } from 'src/modules/employee-job-record/entities/employee-job-record.entity';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 30 })
  code: string;

  @Column({ length: 150 })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string | null;

  @Column({ nullable: true, type: 'text' })
  responsibilities: string | null;

  @Column({ nullable: true, type: 'text' })
  requirements: string | null;

  @Column({ default: true })
  isActive: boolean;

  // Relación directa (si usas position en employee)
  @OneToMany(() => Employee, (employee) => employee.position)
  employees: Employee[];

  // Relación histórica (la importante en tu modelo)
  @OneToMany(() => EmployeeJobRecord, (record) => record.position)
  jobRecords: EmployeeJobRecord[];

  @OneToMany(() => EmployeeJobRecord, (record) => record.functionalPosition)
  functionalJobRecords: EmployeeJobRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
