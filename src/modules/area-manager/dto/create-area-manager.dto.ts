import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAreaManagerDto {
  @IsUUID()
  area_id: string;

  @IsUUID()
  employee_id: string;

  @IsBoolean()
  is_a_delegate: boolean;

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
