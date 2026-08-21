import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateExitPermitSupportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8_000_000)
  base64FileFoto: string;
}
