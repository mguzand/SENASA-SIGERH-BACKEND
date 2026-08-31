import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateEmployeeEditableDto {
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  marital_status?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  biometric_id?: string | null;

  @IsOptional()
  @IsUUID()
  schedule_id?: string | null;

  @IsOptional()
  @IsUUID()
  regional_id?: string | null;

  @IsOptional()
  @IsUUID()
  nominal_position?: string | null;

  @IsOptional()
  @IsUUID()
  functional_position?: string | null;

  @IsOptional()
  @IsUUID()
  organizational_type?: string | null;

  @IsOptional()
  @IsUUID()
  area_id?: string | null;

  @IsOptional()
  @IsNumber()
  salary?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(4_000_000)
  profile_photo_base64?: string | null;
}
