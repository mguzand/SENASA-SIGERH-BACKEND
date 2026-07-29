import { IsUUID } from 'class-validator';

export class CreateRegionalManagerDto {
  @IsUUID()
  regional_id: string;

  @IsUUID()
  employee_id: string;
}
