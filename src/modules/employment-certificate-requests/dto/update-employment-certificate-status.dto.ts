import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { EmploymentCertificateStatus } from '../enums/employment-certificate-status.enum';

export class UpdateEmploymentCertificateStatusDto {
  @IsEnum(EmploymentCertificateStatus)
  status: EmploymentCertificateStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
