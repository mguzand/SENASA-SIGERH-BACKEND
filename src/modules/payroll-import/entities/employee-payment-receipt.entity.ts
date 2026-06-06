import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { PayrollImport } from './payroll-import.entity';
import { EmployeePaymentReceiptItem } from './employee-payment-receipt-item.entity';

@Entity('employee_payment_receipts')
export class EmployeePaymentReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payroll_import_id' })
  payrollImportId: string;

  @ManyToOne(() => PayrollImport, (payrollImport) => payrollImport.receipts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'payroll_import_id' })
  payrollImport: PayrollImport;

  @Column({ name: 'employee_id' })
  employeeId: string;

  @ManyToOne(() => Employee, { eager: false })
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  @Column({ name: 'identity_number' })
  identityNumber: string;

  @Column({ name: 'employee_name_from_file', type: 'text' })
  employeeNameFromFile: string | null;

  @Column({ nullable: true, type: 'varchar', length: 30 })
  month: string | null;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({
    name: 'payroll_class',
    nullable: true,
    type: 'varchar',
    length: 50,
  })
  payrollClass: string | null;

  @Column({ name: 'payroll_type', nullable: true, type: 'varchar', length: 50 })
  payrollType: string | null;

  @Column({
    name: 'ordinary_salary',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  ordinarySalary: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  increments: number;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  seniority: number;

  @Column({
    name: 'variable_salaries_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  variableSalariesTotal: number;

  @Column({
    name: 'bonuses_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  bonusesTotal: number;

  @Column({
    name: 'integral_salary',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  integralSalary: number;

  @Column({
    name: 'deductions_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  deductionsTotal: number;

  @Column({
    name: 'withholdings_total',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  withholdingsTotal: number;

  @Column({
    name: 'net_salary',
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
  })
  netSalary: number;

  @Column({ name: 'amount_in_words', type: 'text' })
  amountInWords: string;

  @Column({
    name: 'document_number',
    nullable: true,
    type: 'varchar',
    length: 50,
  })
  documentNumber: string | null;

  @Column({ name: 'bank_name', nullable: true, type: 'varchar', length: 100 })
  bankName: string | null;

  @Column({
    name: 'bank_account',
    nullable: true,
    type: 'varchar',
    length: 100,
  })
  bankAccount: string | null;

  @Column({
    name: 'raw_page_text',
    type: 'text',
    nullable: true,
  })
  rawPageText: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @OneToMany(() => EmployeePaymentReceiptItem, (item) => item.receipt, {
    cascade: true,
  })
  items: EmployeePaymentReceiptItem[];
}
