import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

import { EmploymentCertificateType } from '../enums/employment-certificate-type.enum';

export class CreateEmploymentCertificateRequestDto {
  @IsEnum(EmploymentCertificateType)
  type: EmploymentCertificateType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  embassyName?: string;

  @IsOptional()
  @IsDateString()
  appointmentDate?: string;
}
