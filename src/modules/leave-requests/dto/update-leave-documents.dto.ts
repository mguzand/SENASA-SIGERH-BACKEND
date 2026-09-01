import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { LeaveDocumentDto } from './create-leave-request.dto';

export class UpdateLeaveDocumentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveDocumentDto)
  documents: LeaveDocumentDto[];
}
