import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class CreateAreaManagerDto {
  @IsUUID()
  area_id: string;

  @IsUUID()
  employee_id: string;

  @IsBoolean()
  is_a_delegate: boolean;

  @ValidateIf((o) => o.is_a_delegate === true)
  @IsDateString()
  delegation_end_date?: string | null;

  @IsOptional()
  @IsString()
  original_name?: string | null;

  @IsOptional()
  @IsString()
  extension?: string | null;

  @IsOptional()
  @IsString()
  mime_type?: string | null;

  @IsOptional()
  @IsString()
  support_document_base64?: string | null;
}
