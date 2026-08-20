import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ResetEmployeePasswordDto {
  @IsString()
  @MinLength(8, { message: 'La contraseña debe contener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La contraseña no puede superar 72 caracteres.' })
  password: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean = true;
}
