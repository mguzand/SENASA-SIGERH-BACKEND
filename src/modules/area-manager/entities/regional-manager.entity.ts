import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Entity,
} from 'typeorm';
import { Employee } from 'src/modules/employees/entities/employee.entity';
import { Regional } from 'src/modules/regional/entities/regional.entity';

@Entity('regional_managers')
export class RegionalManager {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  regional_id: string;

  @Column({ type: 'uuid' })
  employee_id: string;

  @Column({ default: true })
  is_active: boolean;

  @ManyToOne(() => Regional)
  @JoinColumn({ name: 'regional_id' })
  regional: Regional;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ type: 'timestamp', nullable: true })
  created_at?: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at?: Date;

  @BeforeInsert()
  setDefaultDates() {
    const now = new Date();
    this.created_at = now;
    this.updated_at = now;
  }

  @BeforeUpdate()
  setDefaultDate() {
    this.updated_at = new Date();
  }
}
