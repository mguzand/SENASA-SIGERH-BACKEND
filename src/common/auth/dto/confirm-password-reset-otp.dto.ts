import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ConfirmPasswordResetOtpDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, {
    message: 'El codigo debe contener 6 digitos.',
  })
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  new_password: string;
}
