import { IsNotEmpty, IsString } from 'class-validator';

export class RequestPasswordResetOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
