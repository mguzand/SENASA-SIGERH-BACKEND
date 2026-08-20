import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { LeaveReasonType, LeaveRelationship } from '../enums/leave-request.enums';

export class LeaveDocumentDto {
  @IsString() code: string;
  @IsString() @MaxLength(180) name: string;
  @IsString() mimeType: string;
  @IsString() base64: string;
}

export class CreateLeaveRequestDto {
  @IsEnum(LeaveReasonType)
  reasonType: LeaveReasonType;

  @ValidateIf((value) => value.reasonType !== LeaveReasonType.PERSONAL)
  @IsEnum(LeaveRelationship)
  relationship?: LeaveRelationship;

  @IsOptional()
  @IsBoolean()
  differentDomicile?: boolean;
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveDocumentDto)
  documents: LeaveDocumentDto[];
}
