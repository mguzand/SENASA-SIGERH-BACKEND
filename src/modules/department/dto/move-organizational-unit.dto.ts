import { IsUUID, ValidateIf } from 'class-validator';

export class MoveOrganizationalUnitDto {
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  parentId: string | null;

  // Mandatory, but nullable: prevents overwriting a move made by another user.
  @ValidateIf((_object, value) => value !== null)
  @IsUUID()
  expectedParentId: string | null;
}
