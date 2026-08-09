import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
