import { IsUUID } from 'class-validator';

export class AssignLeaveFinalApproverDto {
  @IsUUID()
  employee_id: string;
}
