import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';
import { EmploymentCertificateRequest } from './entities/employment-certificate-request.entity';
import { EmploymentCertificateRequestsController } from './employment-certificate-requests.controller';
import { EmploymentCertificateRequestsService } from './employment-certificate-requests.service';
import { Components } from '../components/entities/components.entity';
import { RolUser } from '../rol-user/entities/rol-user.entity';
import { EmployeePaymentReceipt } from '../payroll-import/entities/employee-payment-receipt.entity';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmploymentCertificateRequest,
      User,
      Components,
      RolUser,
      EmployeePaymentReceipt,
    ]),
    CommonModule,
  ],
  controllers: [EmploymentCertificateRequestsController],
  providers: [EmploymentCertificateRequestsService],
})
export class EmploymentCertificateRequestsModule implements OnModuleInit {
  constructor(private readonly service: EmploymentCertificateRequestsService) {}

  async onModuleInit() {
    await this.service.ensurePermissionComponent();
  }
}
