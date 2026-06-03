import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListEmployeeIntakeDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'reviewed', 'converted', 'all'])
  status?: 'pending' | 'reviewed' | 'converted' | 'all';

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
