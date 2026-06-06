import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PayrollImportController } from './payroll-import.controller';
import { PayrollImportService } from './payroll-import.service';
import { PayrollImport } from './entities/payroll-import.entity';
import { PayrollImportError } from './entities/payroll-import-error.entity';
import { EmployeePaymentReceipt } from './entities/employee-payment-receipt.entity';
import { EmployeePaymentReceiptItem } from './entities/employee-payment-receipt-item.entity';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeesModule } from '../employees/employees.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PayrollImport,
      PayrollImportError,
      EmployeePaymentReceipt,
      EmployeePaymentReceiptItem,
      Employee,
    ]),
    EmployeesModule,
    CommonModule,
  ],
  controllers: [PayrollImportController],
  providers: [PayrollImportService],
  exports: [PayrollImportService],
})
export class PayrollImportModule {}
