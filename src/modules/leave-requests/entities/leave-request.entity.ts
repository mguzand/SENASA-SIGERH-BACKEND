import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { OrganizationalUnit } from '../../department/entities/organizational-unit.entity';
import { Regional } from '../../regional/entities/regional.entity';
import {
  LeaveRequestStage,
  LeaveRequestStatus,
  LeaveRequestType,
} from '../enums/leave-request.enums';
import { LeaveVacationImpact } from './leave-vacation-impact.entity';

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_number', type: 'varchar', length: 20, unique: true })
  requestNumber: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId: string;

  @ManyToOne(() => OrganizationalUnit, { nullable: false })
  @JoinColumn({ name: 'area_id' })
  area: OrganizationalUnit;

  @Column({ name: 'regional_id', type: 'uuid' })
  regionalId: string;

  @ManyToOne(() => Regional, { nullable: false })
  @JoinColumn({ name: 'regional_id' })
  regional: Regional;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'business_days', type: 'int' })
  businessDays: number;

  @Column({ type: 'enum', enum: LeaveRequestType })
  type: LeaveRequestType;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: LeaveRequestStage })
  stage: LeaveRequestStage;

  @Column({ type: 'enum', enum: LeaveRequestStatus })
  status: LeaveRequestStatus;

  @Column({ name: 'hr_employee_id', type: 'uuid', nullable: true })
  hrEmployeeId: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'hr_employee_id' })
  hrEmployee: Employee | null;

  @Column({ name: 'hr_status', type: 'enum', enum: LeaveRequestStatus })
  hrStatus: LeaveRequestStatus;

  @Column({ name: 'hr_observation', type: 'text', nullable: true })
  hrObservation: string | null;

  @Column({ name: 'hr_reviewed_at', type: 'timestamp', nullable: true })
  hrReviewedAt: Date | null;

  @Column({ name: 'director_employee_id', type: 'uuid', nullable: true })
  directorEmployeeId: string | null;

  @ManyToOne(() => Employee, { nullable: true })
  @JoinColumn({ name: 'director_employee_id' })
  directorEmployee: Employee | null;

  @Column({ name: 'director_status', type: 'enum', enum: LeaveRequestStatus })
  directorStatus: LeaveRequestStatus;

  @Column({ name: 'director_observation', type: 'text', nullable: true })
  directorObservation: string | null;

  @Column({ name: 'director_reviewed_at', type: 'timestamp', nullable: true })
  directorReviewedAt: Date | null;

  @Column({ name: 'vacation_impact_applied', default: false })
  vacationImpactApplied: boolean;

  @Column({ name: 'vacation_impact_applied_at', type: 'timestamp', nullable: true })
  vacationImpactAppliedAt: Date | null;

  @OneToMany(() => LeaveVacationImpact, (impact) => impact.leaveRequest)
  vacationImpacts: LeaveVacationImpact[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
