import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EmployeePaymentReceipt } from './employee-payment-receipt.entity';
import { PayrollImportError } from './payroll-import-error.entity';

@Entity('payroll_imports')
export class PayrollImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'period_month', type: 'varchar', length: 50, nullable: true })
  periodMonth: string | null;

  @Column({ name: 'period_year', type: 'int', nullable: true })
  periodYear: number | null;

  @Column({
    name: 'payroll_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  payrollType: string | null;

  @Column({ name: 'status', type: 'varchar', length: 50, default: 'PENDING' })
  status: string;

  @Column({ name: 'uploaded_by', type: 'varchar', length: 255, nullable: true })
  uploadedBy: string | null;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @OneToMany(() => EmployeePaymentReceipt, (receipt) => receipt.payrollImport)
  receipts: EmployeePaymentReceipt[];

  @OneToMany(() => PayrollImportError, (error) => error.payrollImport)
  errors: PayrollImportError[];
}
