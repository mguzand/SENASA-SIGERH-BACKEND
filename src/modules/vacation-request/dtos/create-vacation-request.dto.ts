import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateVacationRequestDto {
  @IsUUID()
  employee_id: string;

  @IsUUID()
  area_id: string;

  @IsArray()
  @IsDateString({}, { each: true })
  days: string[];

  @IsOptional()
  @IsString()
  employee_comment?: string;
}
