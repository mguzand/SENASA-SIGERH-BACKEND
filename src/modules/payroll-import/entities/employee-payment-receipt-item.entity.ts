import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmployeePaymentReceipt } from './employee-payment-receipt.entity';
import { PayrollItemType } from '../enum/payroll-item-type.enum';

@Entity('employee_payment_receipt_items')
export class EmployeePaymentReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'receipt_id' })
  receiptId: string;

  @ManyToOne(() => EmployeePaymentReceipt, (receipt) => receipt.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'receipt_id' })
  receipt: EmployeePaymentReceipt;

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: PayrollItemType,
  })
  itemType: PayrollItemType;

  @Column({ nullable: true, type: 'varchar', length: 50 })
  code: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 })
  amount: number;
}
