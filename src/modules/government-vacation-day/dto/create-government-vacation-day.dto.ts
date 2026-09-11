import { ArrayUnique, IsArray, IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateGovernmentVacationDayDto {
  @IsDateString()
  date: string;

  @IsString()
  @MaxLength(150)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  excludedEmployeeIds: string[] = [];
}
