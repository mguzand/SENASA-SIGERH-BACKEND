import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateExitPermitSupportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(14_500_000)
  base64FileFoto: string;
}
