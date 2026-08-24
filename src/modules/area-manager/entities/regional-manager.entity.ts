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
import { RegionalManagerRole } from '../interfaces/regional-manager-role.enum';

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

  @Column({
    type: 'varchar',
    length: 30,
    default: RegionalManagerRole.REGIONAL_MANAGER,
  })
  role: RegionalManagerRole;

  @Column({ default: false })
  can_review_vacations: boolean;

  @Column({ default: false })
  can_review_exit_permits: boolean;

  @Column({ default: false })
  can_review_leaves: boolean;

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
