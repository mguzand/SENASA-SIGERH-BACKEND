import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '../../common/common.module';
import { Employee } from '../employees/entities/employee.entity';
import { DigitalSignatureRequestsController } from './digital-signature-requests.controller';
import { DigitalSignatureRequestsService } from './digital-signature-requests.service';
import { DigitalSignatureRequest } from './entities/digital-signature-request.entity';

@Module({ imports: [TypeOrmModule.forFeature([DigitalSignatureRequest, Employee]), CommonModule], controllers: [DigitalSignatureRequestsController], providers: [DigitalSignatureRequestsService] })
export class DigitalSignatureRequestsModule {}
