import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class UpdateGovernmentVacationExclusionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  excludedEmployeeIds: string[];
}
