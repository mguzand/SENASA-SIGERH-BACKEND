import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VacationPeriodStatus } from 'src/common/enums/vacation.enums';

export class ManualAdjustVacationPeriodItemDto {
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(0)
  earned_days: number;

  @IsNumber()
  @Min(0)
  used_days: number;

  @IsNumber()
  @Min(0)
  government_days: number;

  @IsNumber()
  adjustment_days: number;

  @IsEnum(VacationPeriodStatus)
  status: VacationPeriodStatus;
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
