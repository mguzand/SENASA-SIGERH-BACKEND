// vacation-request.entity.ts

import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

import { Employee } from '../../employees/entities/employee.entity';
import { VacationRequestStatus } from 'src/common/enums/vacation.enums';

import { VacationRequestDetail } from 'src/modules/vacation-request-detail/entities/vacation-request-detail.entity';
import { VacationRequestAdjustment } from './vacation-request-adjustment.entity';
import { VacationRequestStage } from '../enum/vacation-request-stage.enum';
import { OrganizationalUnit } from 'src/modules/department/entities/organizational-unit.entity';
import { VacationRequestDay } from 'src/modules/vacation_request_days/entities/vacation_request_days.entity';

@Entity('vacation_requests')
export class VacationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  employee_id: string;

  @Column('uuid')
  area_id: string;

  @Column({ type: 'uuid', nullable: true })
  regional_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  approval_scope: 'AREA' | 'REGIONAL' | null;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  end_date: string;

  @Column({ type: 'numeric', precision: 5, scale: 2 })
  requested_days: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  approved_days: number;

  @Column({
    type: 'enum',
    enum: VacationRequestStage,
    default: VacationRequestStage.BOSS_REVIEW,
  })
  stage: VacationRequestStage;

  @Column({
    type: 'enum',
    enum: VacationRequestStatus,
    default: VacationRequestStatus.PENDING,
  })
  status: VacationRequestStatus;

  @Column({ type: 'text', nullable: true })
  employee_comment: string | null;

  // =========================
  // JEFE
  // =========================

  @Column({
    type: 'uuid',
    nullable: true,
  })
  boss_employee_id: string | null;

  @Column({
    type: 'enum',
    enum: VacationRequestStatus,
    default: VacationRequestStatus.PENDING,
  })
  boss_status: VacationRequestStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  boss_observation: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  boss_reviewed_at: Date | null;

  // =========================
  // RRHH
  // =========================

  @Column({
    type: 'uuid',
    nullable: true,
  })
  hr_employee_id: string | null;

  @Column({
    type: 'enum',
    enum: VacationRequestStatus,
    default: VacationRequestStatus.PENDING,
  })
  hr_status: VacationRequestStatus;

  @Column({
    type: 'text',
    nullable: true,
  })
  hr_observation: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  hr_reviewed_at: Date | null;

  @Column({ default: false })
  liaison_review_required: boolean;

  @Column({ type: 'uuid', nullable: true })
  liaison_employee_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  liaison_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null;

  @Column({ type: 'text', nullable: true })
  liaison_observation: string | null;

  @Column({ type: 'timestamp', nullable: true })
  liaison_reviewed_at: Date | null;

  // =========================
  // PROCESAMIENTO DE SALDO
  // =========================

  @Column({
    default: false,
  })
  is_processed: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  processed_at: Date | null;

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

  @OneToMany(() => VacationRequestDetail, (detail) => detail.vacationRequest, {
    cascade: true,
  })
  details: VacationRequestDetail[];

  @OneToMany(
    () => VacationRequestAdjustment,
    (adjustment) => adjustment.vacationRequest,
  )
  adjustments: VacationRequestAdjustment[];

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

  @BeforeInsert()
  setDefaultDates() {
    const date = new Date();
    this.created_at = date;
    this.updated_at = date;
  }

  @Column({ default: false })
  is_manual: boolean;

  @BeforeUpdate()
  setDefaultDate() {
    this.updated_at = new Date();
  }

  @OneToMany(() => VacationRequestDay, (day) => day.vacationRequest, {
    cascade: true,
  })
  days: VacationRequestDay[];
}
