import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListReceptionExitPermitsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['all', 'pending', 'approved', 'rejected', 'cancelled']) status?: string;
  @IsOptional() @IsIn(['all', 'pending', 'reviewed']) reception?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
