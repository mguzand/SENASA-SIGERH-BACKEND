import { OrganizationalUnit } from 'src/modules/department/entities/organizational-unit.entity';
import { Employee } from 'src/modules/employees/entities/employee.entity';
import { EmploymentModality } from 'src/modules/employment_modalities/entities/employment-modality.entity';
import { Position } from 'src/modules/position/entities/position.entity';
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

@Entity('employee_job_records')
export class EmployeeJobRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid', nullable: false })
  employeeId: string;

  @Column({ name: 'modality_id', type: 'uuid', nullable: false })
  modalityId: string;

  @ManyToOne(() => Employee, (employee) => employee.jobRecords)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ nullable: true, name: 'nominal_position', type: 'uuid' })
  nominal_position: string | null;

  @Column({ nullable: true, name: 'functional_position', type: 'uuid' })
  functional_position: string | null;

  @ManyToOne(
    () => EmploymentModality,
    (modality) => modality.employeeJobRecords,
  )
  @JoinColumn({ name: 'modality_id' })
  modality: EmploymentModality;

  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  area_id: string | null;

  @ManyToOne(() => Position, (position) => position.jobRecords)
  @JoinColumn({ name: 'nominal_position' })
  position: Position;

  @ManyToOne(() => Position, (position) => position.functionalJobRecords)
  @JoinColumn({ name: 'functional_position' })
  functionalPosition: Position;
  //

  @ManyToOne(() => OrganizationalUnit, (area) => area.employeeJobRecord)
  @JoinColumn({ name: 'area_id' })
  area: OrganizationalUnit;

  //   @ManyToOne(() => Department, { nullable: true })
  //   @JoinColumn({ name: 'nominal_area_id' })
  //   nominalArea: Department;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: Date | null;

  @Column({ type: 'text', nullable: true })
  functions: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  salary: number;

  @Column({ length: 30, default: 'ACTIVE' })
  status: string;

  @Column({ default: false })
  isCurrent: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'previous_record_id', nullable: true, type: 'uuid' })
  previousRecordId: string | null;

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
