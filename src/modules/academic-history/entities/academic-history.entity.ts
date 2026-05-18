import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('academic_histories')
export class AcademicHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, (employee) => employee.academicHistories, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @Column({ length: 100 })
  nivel: string;

  @Column({ length: 200 })
  institution: string;

  @Column({ length: 200, nullable: true })
  career: string;

  @Column({ length: 200, nullable: true })
  title: string;

  @Column({ name: 'start_year', type: 'int', nullable: true })
  startYear: number;

  @Column({ name: 'end_year', type: 'int', nullable: true })
  endYear: number;

  @Column({ name: 'in_progress', default: false })
  inProgress: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

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
