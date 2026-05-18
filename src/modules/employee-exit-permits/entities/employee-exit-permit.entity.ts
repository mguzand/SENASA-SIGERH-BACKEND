import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';
import { ExitPermitStage } from '../enums/exit-permit-stage.enum';
import { ExitPermitStatus } from '../enums/exit-permit-status.enum';
import { OrganizationalUnit } from 'src/modules/department/entities/organizational-unit.entity';

@Entity('employee_exit_permits')
export class EmployeeExitPermit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  employee_id: string;

  @Column('uuid')
  area_id: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: ExitPermitStage,
    default: ExitPermitStage.BOSS_REVIEW,
  })
  stage: ExitPermitStage;

  @Column({
    type: 'enum',
    enum: ExitPermitStatus,
    default: ExitPermitStatus.PENDING,
  })
  status: ExitPermitStatus;

  @Column({
    type: 'date',
  })
  exit_date: Date;

  @Column({
    type: 'time',
  })
  exit_time: string;

  @Column({
    type: 'time',
    nullable: true,
  })
  return_time: string | null;

  @Column({
    default: false,
  })
  without_return: boolean;

  // =========================
  // JEFE
  // =========================

  @Column({
    type: 'uuid',
    nullable: true,
  })
  boss_employee_id: string;

  @Column({
    type: 'enum',
    enum: ExitPermitStatus,
    default: ExitPermitStatus.PENDING,
  })
  boss_status: ExitPermitStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  boss_observation: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  boss_reviewed_at: Date;

  // =========================
  // RRHH
  // =========================

  @Column({
    type: 'uuid',
    nullable: true,
  })
  hr_employee_id: string;

  @Column({
    type: 'enum',
    enum: ExitPermitStatus,
    default: ExitPermitStatus.PENDING,
  })
  hr_status: ExitPermitStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  hr_observation: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  hr_reviewed_at: Date;

  // =========================
  // RELACIONES
  // =========================

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @ManyToOne(() => OrganizationalUnit)
  @JoinColumn({ name: 'area_id' })
  area: OrganizationalUnit;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'boss_employee_id' })
  boss_employee: Employee;

  @ManyToOne(() => Employee)
  @JoinColumn({ name: 'hr_employee_id' })
  hr_employee: Employee;

  // =========================

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
