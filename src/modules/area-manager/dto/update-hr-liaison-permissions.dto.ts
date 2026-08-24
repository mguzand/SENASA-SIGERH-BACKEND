import { IsBoolean } from 'class-validator';

export class UpdateHrLiaisonPermissionsDto {
  @IsBoolean()
  can_review_vacations: boolean;

  @IsBoolean()
  can_review_exit_permits: boolean;

  @IsBoolean()
  can_review_leaves: boolean;
}
