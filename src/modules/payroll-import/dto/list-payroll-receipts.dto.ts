import { IsIn, IsOptional, IsString } from 'class-validator';

export class ListPayrollReceiptsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;
}
