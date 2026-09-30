import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { LeaveMarriageType, LeaveReasonType, LeaveRelationship, LeaveRequestType } from '../enums/leave-request.enums';

export class UpdateLeaveClassificationDto {
  @IsEnum(LeaveRequestType)
  type: LeaveRequestType;

  @IsEnum(LeaveReasonType)
  reasonType: LeaveReasonType;

  @ValidateIf((value) => [LeaveReasonType.DEATH, LeaveReasonType.IHSS, LeaveReasonType.FAMILY_CARE].includes(value.reasonType))
  @IsEnum(LeaveRelationship)
  relationship?: LeaveRelationship;

  @IsOptional()
  @IsBoolean()
  differentDomicile?: boolean;

  @ValidateIf((value) => value.reasonType === LeaveReasonType.MARRIAGE)
  @IsEnum(LeaveMarriageType)
  marriageType?: LeaveMarriageType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  correctionReason: string;
}
