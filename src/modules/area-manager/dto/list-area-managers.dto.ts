import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListAreaManagersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  areaId?: string;

  @IsOptional()
  @IsIn(['all', 'boss', 'delegate'])
  type?: 'all' | 'boss' | 'delegate';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
