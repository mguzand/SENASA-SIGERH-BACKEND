import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ManualAdjustVacationPeriodItemDto {
  @IsUUID()
  id: string;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsDateString()
  accreditation_date: string;

  @IsNumber()
  @Min(0)
  used_days: number;

  @IsNumber()
  @Min(0)
  government_days: number;

  @IsNumber()
  adjustment_days: number;
}

export class ManualAdjustVacationPeriodsDto {
  @IsString()
  @IsNotEmpty()
  observation: string;

  @IsOptional()
  @IsString()
  adjustment_date?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualAdjustVacationPeriodItemDto)
  periods: ManualAdjustVacationPeriodItemDto[];
}

export class PreviewAdjustVacationPeriodsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualAdjustVacationPeriodItemDto)
  periods: ManualAdjustVacationPeriodItemDto[];
}
