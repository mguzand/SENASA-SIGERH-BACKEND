import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PublicIntakeLevelDto {
  @IsString()
  name: string;

  @IsString()
  value: string;
}

export class PublicIntakeAcademicHistoryDto {
  @ValidateNested()
  @Type(() => PublicIntakeLevelDto)
  level: PublicIntakeLevelDto;

  @IsString()
  institution: string;

  @IsString()
  career: string;

  @IsString()
  title: string;

  @IsInt()
  startYear: number;

  @IsOptional()
  @IsInt()
  endYear?: number | null;

  @IsBoolean()
  inProgress: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class PublicIntakeDocumentDto {
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
  @IsDateString()
  expirationDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateEmployeeIntakeDto {
  @IsString()
  @IsNotEmpty()
  @Length(13, 20)
  identity: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  full_name?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(10, 30)
  rtn: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  marital_status?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  blood_type?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  home_address?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicIntakeAcademicHistoryDto)
  academic_history?: PublicIntakeAcademicHistoryDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicIntakeDocumentDto)
  general_documents?: PublicIntakeDocumentDto[];

  @IsOptional()
  @IsString()
  emergency_contact_name?: string | null;

  @IsOptional()
  @IsString()
  emergency_contact_relationship?: string | null;

  @IsOptional()
  @IsString()
  emergency_contact_phone?: string | null;

  @IsString()
  @IsNotEmpty()
  cv_base64: string;

  @IsOptional()
  @IsString()
  cv_original_name?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(/^[a-zA-Z0-9]+$/)
  cv_extension?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  cv_mime_type?: string | null;

  @IsString()
  @IsNotEmpty()
  criminal_record_base64?: string | null;

  @IsString()
  @IsNotEmpty()
  criminal_record_original_name?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  @Matches(/^[a-zA-Z0-9]+$/)
  criminal_record_extension?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  criminal_record_mime_type?: string | null;

  @IsDateString()
  @IsNotEmpty()
  criminal_record_expiration_date?: string | null;
}
