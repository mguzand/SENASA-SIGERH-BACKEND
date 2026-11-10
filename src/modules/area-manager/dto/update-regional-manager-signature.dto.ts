import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateRegionalManagerSignatureDto {
  @IsString()
  @IsNotEmpty()
  signature_base64: string;

  @IsString()
  @MaxLength(255)
  original_name: string;

  @IsString()
  @IsIn(['image/png', 'image/jpeg', 'image/webp'])
  mime_type: string;
}
