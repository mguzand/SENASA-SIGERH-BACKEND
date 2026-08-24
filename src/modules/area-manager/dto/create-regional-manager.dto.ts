import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class CreateRegionalManagerDto {
  @IsUUID()
  regional_id: string;

  @IsUUID()
  employee_id: string;

  @IsBoolean()
  @IsOptional()
  can_review_vacations?: boolean;

  @IsBoolean()
  @IsOptional()
  can_review_exit_permits?: boolean;

  @IsBoolean()
  @IsOptional()
  can_review_leaves?: boolean;
}
