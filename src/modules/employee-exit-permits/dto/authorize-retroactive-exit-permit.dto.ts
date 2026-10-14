import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class AuthorizeRetroactiveExitPermitDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
