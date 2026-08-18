import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class MonthlyAttendanceFilterDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsUUID()
  regionalId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
