import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ReviewEmployeeIntakeDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  no_organizational_type?: string | null;

  @IsUUID()
  @IsNotEmpty()
  area_id: string;

  @IsUUID()
  @IsNotEmpty()
  nominal_position: string;

  @IsUUID()
  @IsNotEmpty()
  functional_position: string;

  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @IsNumber()
  @Min(0)
  salary: number;

  @IsUUID()
  @IsNotEmpty()
  modality_id: string;

  @IsUUID()
  @IsNotEmpty()
  schedule_id: string;

  @IsUUID()
  @IsNotEmpty()
  regional_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  employee_status: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  biometric_id: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergency_contact_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  emergency_contact_relationship?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergency_contact_phone?: string | null;
}
