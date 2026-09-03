import { IsString, MaxLength, Matches } from 'class-validator';

export class RequestSupportChangeDto {
  @IsString()
  @Matches(/\S/, { message: 'Debe indicar el motivo del cambio de documento.' })
  @MaxLength(1000)
  observation: string;
}
