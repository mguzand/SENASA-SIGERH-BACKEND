import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SuspendVacationRequestDto {
  @ValidateIf((dto) => !dto.suspend_all_remaining)
  @IsArray()
  @ArrayNotEmpty()
  @IsISO8601({ strict: true }, { each: true })
  days?: string[];

  @ValidateIf((dto) => dto.suspend_all_remaining)
  @IsISO8601({ strict: true })
  suspension_date?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Transform(({ value }) => String(value || '').trim())
  reason: string;

  @IsOptional()
  @IsBoolean()
  suspend_all_remaining = false;
}
