import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewExitPermitReceptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;
}
