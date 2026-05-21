import { IsNotEmpty, IsOptional } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Se debe especificar la contrasenia.' })
  password: string;

  @IsNotEmpty({ message: 'Se debe especificar el id usuario.' })
  username: string;
}
