import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateEmployeeIntakeDto {
  @IsString()
  @IsNotEmpty()
  @Length(13, 20)
  identity: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  full_name?: string | null;

  @IsString()
  @IsNotEmpty()
  @Length(10, 30)
  rtn: string;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  marital_status?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 10)
  blood_type?: string | null;

  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsOptional()
  @IsString()
  home_address?: string | null;

  @IsString()
  @IsNotEmpty()
  cv_base64: string;

  @IsOptional()
  @IsString()
  cv_original_name?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  @Matches(/^[a-zA-Z0-9]+$/)
  cv_extension?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  cv_mime_type?: string | null;
}
