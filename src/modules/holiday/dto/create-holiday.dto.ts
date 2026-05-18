import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { HolidayType } from '../entities/holiday.entity';

export class CreateHolidayDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsDateString()
  date: string;

  @IsEnum(HolidayType)
  type: HolidayType;

  @IsOptional()
  @IsString()
  description?: string;
}
