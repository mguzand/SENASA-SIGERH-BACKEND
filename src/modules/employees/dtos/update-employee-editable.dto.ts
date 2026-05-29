import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

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
  nominal_position?: string | null;

  @IsOptional()
  @IsUUID()
  functional_position?: string | null;

  @IsOptional()
  @IsNumber()
  salary?: number | null;
}
