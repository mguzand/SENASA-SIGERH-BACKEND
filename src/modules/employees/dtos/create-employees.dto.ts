import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VacationPeriodStatus } from 'src/common/enums/vacation.enums';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  intake_request_id?: string;

  @IsString()
  @IsNotEmpty()
  dni: string;

  @IsString()
  @IsOptional()
  rtn: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsOptional()
  middleName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  secondLastName: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsString()
  @IsOptional()
  biometric_id: string;

  @IsString()
  @IsOptional()
  marital_status: string;

  @IsString()
  @IsOptional()
  type_blood: string;

  @IsDateString()
  birth_date: string;

  @IsString()
  @IsOptional()
  birth_place: string;

  @IsString()
  @IsOptional()
  address: string;

  @IsString()
  @IsNotEmpty()
  schedule_id: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone: string;

  @IsString()
  @IsNotEmpty()
  regional_id: string;

  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsOptional()
  no_organizational_type?: string;

  @IsString()
  @IsNotEmpty()
  area_id: string;

  @IsString()
  @IsOptional()
  nominal_position: string;

  @IsString()
  @IsOptional()
  functional_position: string;

  @IsDateString()
  start_date: string;

  @IsNumber()
  salary: number;

  @IsString()
  @IsNotEmpty()
  modality_id: string;

  @IsString()
  @IsOptional()
  emergency_contact_name: string;

  @IsString()
  @IsOptional()
  emergency_contact_relationship: string;

  @IsString()
  @IsOptional()
  emergency_contact_phone: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcademicHistoryDto)
  academicHistory: AcademicHistoryDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  documents: DocumentDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VacationPeriodDto)
  vacation_periods: VacationPeriodDto[];
}

export class DocumentDto {
  @IsString()
  documentTypeKey: string;

  @IsString()
  originalName: string;

  @IsString()
  name: string;

  @IsString()
  extension: string;

  @IsString()
  mimeType: string;

  @IsNumber()
  size: number;

  @IsString()
  base64: string;

  @IsOptional()
  @IsString()
  expirationDate: string | null;

  @IsOptional()
  @IsString()
  notes: string;
}

export class LevelDto {
  @IsString()
  name: string;

  @IsString()
  value: string;
}

export class AcademicHistoryDto {
  @ValidateNested()
  @Type(() => LevelDto)
  level: LevelDto;

  @IsString()
  institution: string;

  @IsString()
  career: string;

  @IsString()
  title: string;

  @IsInt()
  startYear: number;

  @IsInt()
  endYear: number;

  @IsBoolean()
  inProgress: boolean;

  @IsOptional()
  @IsString()
  notes: string;
}

export class VacationPeriodDto {
  @IsInt()
  period_number: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsDateString()
  accreditation_date: string;

  @IsNumber()
  earned_days: number;

  @IsNumber()
  used_days: number;

  @IsNumber()
  government_days: number;

  @IsNumber()
  adjustment_days: number;

  @IsNumber()
  available_days: number;

  @IsEnum(VacationPeriodStatus)
  status: VacationPeriodStatus;
}
