import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class AuthorizeSsoDto {
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @IsString()
  @IsNotEmpty()
  response_type!: string;

  @IsUrl({ require_tld: false })
  redirect_uri!: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  state?: string;
}