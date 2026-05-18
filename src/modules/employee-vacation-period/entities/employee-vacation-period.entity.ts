import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { VacationPeriodStatus } from 'src/common/enums/vacation.enums';
import { VacationRequestDetail } from 'src/modules/vacation-request-detail/entities/vacation-request-detail.entity';
import { VacationMovement } from 'src/modules/vacation-movement/entities/vacation-movement.entity';
import { EmployeeJobRecord } from 'src/modules/employee-job-record/entities/employee-job-record.entity';

@Entity('employee_vacation_periods')
export class EmployeeVacationPeriod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Employee, { nullable: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => EmployeeJobRecord, { nullable: false })
  @JoinColumn({ name: 'employee_job_record_id' })
  employeeJobRecord: EmployeeJobRecord;

  @Column({ name: 'employee_job_record_id' })
  employeeJobRecordId: string;

  @Column({ type: 'int' })
  periodNumber: number;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'date' })
  accreditationDate: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  earnedDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  usedDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  governmentDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  adjustmentDays: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  availableDays: number;

  @Column({
    type: 'enum',
    enum: VacationPeriodStatus,
    default: VacationPeriodStatus.PENDING,
  })
  status: VacationPeriodStatus;

  @OneToMany(() => VacationRequestDetail, (detail) => detail.vacationPeriod)
  requestDetails: VacationRequestDetail[];

  @OneToMany(() => VacationMovement, (movement) => movement.vacationPeriod)
  movements: VacationMovement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
