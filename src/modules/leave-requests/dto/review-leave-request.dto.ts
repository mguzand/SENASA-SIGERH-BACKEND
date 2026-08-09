import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LeaveRequestStatus } from '../enums/leave-request.enums';

export class ReviewLeaveRequestDto {
  @IsEnum(LeaveRequestStatus)
  status: LeaveRequestStatus.APPROVED | LeaveRequestStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string;
}
