import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeExitPermitDto {
  @IsUUID()
  @IsNotEmpty()
  employee_id: string;

  @IsUUID()
  @IsNotEmpty()
  area_id: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  @IsIn([
    'Oficial',
    'Personal',
    'Médico IHSS',
    'Médico Privado',
    'Servicio de Salud Pública',
  ])
  permit_type: string;

  @IsDateString()
  @IsNotEmpty()
  exit_date: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsString()
  @IsNotEmpty()
  exit_time: string;

  @IsString()
  @IsOptional()
  return_time?: string;

  @IsBoolean()
  @IsOptional()
  without_return?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(8_000_000)
  base64FileFoto?: string;
}
