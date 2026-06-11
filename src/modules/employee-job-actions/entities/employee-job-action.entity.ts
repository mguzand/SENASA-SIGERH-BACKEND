import { Employee } from 'src/modules/employees/entities/employee.entity';
import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeeJobActionType } from '../enums/employee-job-action-type.enum';

@Entity('employee_job_actions')
export class EmployeeJobAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'action_number', type: 'varchar', length: 30, unique: true })
  actionNumber: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: EmployeeJobActionType,
  })
  actionType: EmployeeJobActionType;

  @Column({ name: 'modification_date', type: 'date' })
  modificationDate: Date;

  @Column({ name: 'previous_value', type: 'text', nullable: true })
  previousValue: string | null;

  @Column({ name: 'next_value', type: 'text', nullable: true })
  nextValue: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 20, default: 'REGISTERED' })
  status: string;

  @Column({ name: 'new_modality_id', type: 'uuid', nullable: true })
  newModalityId: string | null;

  @Column({ name: 'new_area_id', type: 'uuid', nullable: true })
  newAreaId: string | null;

  @Column({ name: 'new_organizational_type_id', type: 'uuid', nullable: true })
  newOrganizationalTypeId: string | null;

  @Column({ name: 'new_nominal_position_id', type: 'uuid', nullable: true })
  newNominalPositionId: string | null;

  @Column({ name: 'new_functional_position_id', type: 'uuid', nullable: true })
  newFunctionalPositionId: string | null;

  @Column({ name: 'new_employee_status', type: 'varchar', length: 30, nullable: true })
  newEmployeeStatus: string | null;

  @Column({ name: 'previous_job_record_id', type: 'uuid', nullable: true })
  previousJobRecordId: string | null;

  @Column({ name: 'new_job_record_id', type: 'uuid', nullable: true })
  newJobRecordId: string | null;

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

  @BeforeUpdate()
  setUpdatedDate() {
    this.updated_at = new Date();
  }
}
