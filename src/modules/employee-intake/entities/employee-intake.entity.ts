import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('employee_intake_requests', { synchronize: true })
export class EmployeeIntakeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true })
  identity: string;

  @Column({ length: 200, nullable: true, type: 'varchar' })
  full_name: string | null;

  @Column({ length: 30, type: 'varchar' })
  rtn: string;

  @Column({ length: 50, nullable: true, type: 'varchar' })
  marital_status: string | null;

  @Column({ length: 10, nullable: true, type: 'varchar' })
  blood_type: string | null;

  @Column({ length: 150, nullable: true, type: 'varchar' })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  home_address: string | null;

  @Column({ type: 'text' })
  cv_file_path: string;

  @Column({ length: 255, nullable: true, type: 'varchar' })
  cv_original_name: string | null;

  @Column({ length: 20, nullable: true, type: 'varchar' })
  cv_extension: string | null;

  @Column({ length: 120, nullable: true, type: 'varchar' })
  cv_mime_type: string | null;

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
