import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListEmployeeIntakeDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'converted', 'all'])
  status?: 'pending' | 'converted' | 'all';

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
