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

@Entity('employee_documents')
export class EmployeeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId: string;

  @ManyToOne(() => Employee, (employee) => employee.documents, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ length: 100, name: 'document_type' })
  documentType: string;

  @Column({ length: 255, name: 'file_name' })
  fileName: string;

  @Column({ length: 255, nullable: true, name: 'original_name' })
  originalName: string;

  @Column({ length: 20, nullable: true, name: 'extension' })
  extension: string;

  @Column({ length: 150, nullable: true, name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'bigint', nullable: true, name: 'file_size' })
  fileSize: number;

  @Column({ type: 'varchar', length: 255, name: 'file_path' })
  filePath: string;
  // ruta local o URL

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'is_private' })
  isPrivate: boolean;

  @Column({ type: 'date', nullable: true, name: 'issue_date' })
  issueDate: Date;

  @Column({ type: 'date', nullable: true, name: 'expiration_date' })
  expirationDate: Date | null;

  @Column({ type: 'text', nullable: true, name: 'notes' })
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
