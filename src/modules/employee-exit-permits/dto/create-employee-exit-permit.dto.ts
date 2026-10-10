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
    'Otros permisos',
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

  // Optional for backwards compatibility with app versions that still let
  // the server infer the duration from the selected hours.
  @IsString()
  @IsOptional()
  @IsIn(['HALF', 'FULL'])
  personal_duration?: 'HALF' | 'FULL';

  @IsBoolean()
  @IsOptional()
  without_return?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(14_500_000)
  base64FileFoto?: string;
}
