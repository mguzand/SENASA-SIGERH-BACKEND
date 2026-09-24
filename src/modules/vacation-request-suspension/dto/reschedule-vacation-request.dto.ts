import { ArrayMinSize, ArrayUnique, IsArray, IsDateString, IsString, MaxLength, MinLength } from 'class-validator';

export class RescheduleVacationRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsDateString({}, { each: true })
  original_days: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsDateString({}, { each: true })
  new_days: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}
