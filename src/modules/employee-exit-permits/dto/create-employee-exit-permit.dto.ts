import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsDateString()
  @IsNotEmpty()
  exit_date: string;

  @IsString()
  @IsNotEmpty()
  exit_time: string;

  @IsString()
  @IsOptional()
  return_time?: string;

  @IsBoolean()
  @IsOptional()
  without_return?: boolean;
}
