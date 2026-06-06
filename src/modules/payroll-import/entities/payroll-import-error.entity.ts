import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PayrollImport } from './payroll-import.entity';

@Entity('payroll_import_errors')
export class PayrollImportError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payroll_import_id' })
  payrollImportId: string;

  @ManyToOne(() => PayrollImport, (payrollImport) => payrollImport.errors, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payroll_import_id' })
  payrollImport: PayrollImport;

  @Column({ name: 'page_number', type: 'int', nullable: true })
  pageNumber: number | null;

  @Column({
    name: 'identity_number',
    nullable: true,
    length: 15,
    type: 'varchar',
  })
  identityNumber: string | null;

  @Column({
    name: 'employee_name_from_file',
    nullable: true,
    type: 'varchar',
    length: 255,
  })
  employeeNameFromFile: string | null;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage: string;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
