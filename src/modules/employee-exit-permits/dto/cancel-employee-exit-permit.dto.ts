import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CancelEmployeeExitPermitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
