import { IsNotEmpty, IsString } from 'class-validator';

export class SsoTokenDto {
  @IsString()
  @IsNotEmpty()
  client_id!: string;

  @IsString()
  @IsNotEmpty()
  client_secret!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}