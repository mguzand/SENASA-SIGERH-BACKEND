import { IsUUID } from 'class-validator';

export class CheckAreaManagerAccessDto {
  @IsUUID()
  areaId: string;

  @IsUUID()
  employeeId: string;
}
