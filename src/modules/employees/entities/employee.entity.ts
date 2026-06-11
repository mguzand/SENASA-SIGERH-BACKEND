import { AcademicHistory } from 'src/modules/academic-history/entities/academic-history.entity';
import { EmployeeJobRecord } from 'src/modules/employee-job-record/entities/employee-job-record.entity';
import { Position } from 'src/modules/position/entities/position.entity';
import { Regional } from 'src/modules/regional/entities/regional.entity';
import { Schedule } from 'src/modules/schedules/entities/schedule.entity';
import { User } from 'src/modules/users/entities/user.entity';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { EmployeeDocument } from './employee-document.entity';
import { EmployeeEmergencyContact } from './emergency_contacts.interface';
import { EmployeeUnpaidLeave } from './employee-unpaid-leave.entity';

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true, name: 'rtn', type: 'varchar', length: 14 })
  rtn: string | null;

  @Column({ unique: true, name: 'dni', type: 'varchar', length: 13 })
  dni: string;

  @Column({ name: 'first_name', length: 50 })
  firstName: string;

  @Column({ name: 'middle_name', length: 50, nullable: true })
  middleName: string;

  @Column({ name: 'last_name', length: 50 })
  lastName: string;

  @Column({ name: 'second_last_name', length: 50, nullable: true })
  secondLastName: string;

  @Column({ nullable: false, length: 10 })
  gender: string; // Genero

  @Column({ nullable: true, length: 20 })
  marital_status: string;

  @Column({ nullable: true, name: 'type_blood', type: 'varchar', length: 3 })
  type_blood: string;

  @Column({ type: 'date', nullable: true })
  birth_date: Date | null;

  @Column({ nullable: true, name: 'birth_place', type: 'varchar', length: 100 })
  birth_place: string;

  @Column({ nullable: true, name: 'address', type: 'varchar', length: 255 })
  address: string;

  @Column({ nullable: false, name: 'entry_date', type: 'date' })
  entryDate: Date;

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  schedule_id: string; //! Relación con la tabla de horarios------------------------------------

  @Column({ default: 'ACTIVE', name: 'status' })
  status: string;

  @Column({ nullable: true, unique: true, name: 'email' })
  email: string;

  @Column({ nullable: true, name: 'phone' })
  phone: string;

  @Column({ nullable: true, name: 'regional_id', type: 'uuid' })
  regional_id: string; //! Relación con la tabla de regionales------------------------------------

  @Column({ nullable: true, name: 'position_id', type: 'uuid' })
  position_id: string; //! relación con la tabla de posiciones------------------------------------

  @ManyToOne(() => Schedule, (schedule) => schedule.employees)
  @JoinColumn({ name: 'schedule_id' })
  schedule: Schedule;

  @ManyToOne(() => Regional, (regional) => regional.employees, {
    nullable: true,
  })
  @JoinColumn({ name: 'regional_id' })
  regional: Regional;

  @OneToMany(() => EmployeeJobRecord, (record) => record.employee)
  jobRecords: EmployeeJobRecord[];

  @OneToMany(() => AcademicHistory, (record) => record.employee)
  academicHistories: AcademicHistory[];

  @OneToMany(() => EmployeeDocument, (record) => record.employee)
  documents: EmployeeDocument[];

  @OneToMany(() => EmployeeUnpaidLeave, (record) => record.employee)
  unpaidLeaves: EmployeeUnpaidLeave[];

  @OneToOne(() => EmployeeEmergencyContact, (contact) => contact.employee, {
    cascade: true,
  })
  emergencyContact: EmployeeEmergencyContact;

  @ManyToOne(() => Position, (position) => position.employees)
  @JoinColumn({ name: 'position_id' })
  position: Position;

  @Column({ nullable: true, name: 'biometric_id', type: 'varchar', length: 6 })
  biometric_id: string;

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

  @OneToOne(() => User, (user) => user.employee)
  user: User;
}
