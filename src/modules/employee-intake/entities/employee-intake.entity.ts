import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface PublicIntakeAcademicHistoryRecord {
  level: {
    name: string;
    value: string;
  };
  institution: string;
  career: string;
  title: string;
  startYear: number;
  endYear: number | null;
  inProgress: boolean;
  notes: string | null;
}

export interface PublicIntakeGeneralDocumentRecord {
  documentTypeKey: string;
  originalName: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  expirationDate: string | null;
  notes: string | null;
  filePath: string;
}

@Entity('employee_intake_requests', { synchronize: true })
export class EmployeeIntakeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  identity: string;

  @Column({ length: 200, nullable: true, type: 'varchar' })
  full_name: string | null;

  @Column({ length: 30, type: 'varchar', nullable: true })
  rtn: string | null;

  @Column({ length: 50, nullable: true, type: 'varchar' })
  marital_status: string | null;

  @Column({ length: 10, nullable: true, type: 'varchar' })
  blood_type: string | null;

  @Column({ length: 150, nullable: true, type: 'varchar' })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  home_address: string | null;

  @Column({ length: 180, nullable: true, type: 'varchar' })
  birth_place: string | null;

  @Column({ length: 30, nullable: true, type: 'varchar' })
  phone: string | null;

  @Column({ type: 'simple-json', nullable: true })
  academic_history: PublicIntakeAcademicHistoryRecord[] | null;

  @Column({ type: 'simple-json', nullable: true })
  general_documents: PublicIntakeGeneralDocumentRecord[] | null;

  @Column({ type: 'text' })
  cv_file_path: string;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  cv_original_name: string | null;

  @Column({ length: 20, nullable: true, type: 'varchar' })
  cv_extension: string | null;

  @Column({ length: 120, nullable: true, type: 'varchar' })
  cv_mime_type: string | null;

  @Column({ type: 'text', nullable: true })
  criminal_record_file_path: string | null;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  criminal_record_original_name: string | null;

  @Column({ length: 20, nullable: true, type: 'varchar' })
  criminal_record_extension: string | null;

  @Column({ length: 120, nullable: true, type: 'varchar' })
  criminal_record_mime_type: string | null;

  @Column({ type: 'date', nullable: true })
  criminal_record_expiration_date: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  no_organizational_type: string | null;

  @Column({ type: 'uuid', nullable: true })
  area_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  nominal_position: string | null;

  @Column({ type: 'uuid', nullable: true })
  functional_position: string | null;

  @Column({ type: 'date', nullable: true })
  start_date: Date | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  salary: number | null;

  @Column({ type: 'uuid', nullable: true })
  modality_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  schedule_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  regional_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  employee_status: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  biometric_id: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  emergency_contact_name: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  emergency_contact_relationship: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  emergency_contact_phone: string | null;

  @Column({ length: 20, default: 'PENDING', type: 'varchar' })
  status: string;

  @Column({ type: 'uuid', nullable: true })
  converted_employee_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  converted_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
