import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ExitPermitStatus } from '../enums/exit-permit-status.enum';

export class ReviewEmployeeExitPermitDto {
  @IsEnum(ExitPermitStatus)
  status: ExitPermitStatus.APPROVED | ExitPermitStatus.REJECTED;

  @IsString()
  @IsOptional()
  observation?: string;
}
