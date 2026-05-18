// dto/bootstrap-vacation-periods.dto.ts

import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VacationPeriodStatus } from 'src/common/enums/vacation.enums';

class BootstrapVacationPeriodItemDto {
  @IsNumber()
  period_number: number;

  @IsDateString()
  start_date: string;

  @IsDateString()
  end_date: string;

  @IsDateString()
  accreditation_date: string;

  @IsNumber()
  earned_days: number;

  @IsNumber()
  used_days: number;

  @IsNumber()
  government_days: number;

  @IsNumber()
  adjustment_days: number;

  @IsNumber()
  available_days: number;

  @IsEnum(VacationPeriodStatus)
  status: VacationPeriodStatus;
}

export class BootstrapVacationPeriodsDto {
  @IsUUID()
  employee_id: string;

  @IsUUID()
  employee_job_record_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BootstrapVacationPeriodItemDto)
  periods: BootstrapVacationPeriodItemDto[];
}
