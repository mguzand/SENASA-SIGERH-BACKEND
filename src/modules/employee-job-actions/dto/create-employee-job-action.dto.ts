import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { EmployeeJobActionType } from '../enums/employee-job-action-type.enum';

export class CreateEmployeeJobActionDto {
  @IsUUID()
  employee_id: string;

  @IsEnum(EmployeeJobActionType)
  action_type: EmployeeJobActionType;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.MODALITY_CHANGE)
  @IsUUID()
  new_modality_id?: string;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.AREA_CHANGE)
  @IsUUID()
  new_organizational_type_id?: string;

  @ValidateIf(
    (o) =>
      o.action_type === EmployeeJobActionType.AREA_CHANGE ||
      o.action_type === EmployeeJobActionType.POSITION_CHANGE,
  )
  @IsOptional()
  @IsUUID()
  new_area_id?: string;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.POSITION_CHANGE)
  @IsUUID()
  new_nominal_position_id?: string;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.POSITION_CHANGE)
  @IsUUID()
  new_functional_position_id?: string;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.STATUS_CHANGE)
  @IsString()
  new_employee_status?: string;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.UNPAID_LEAVE)
  @IsDateString()
  new_unpaid_leave_start_date?: string;

  @ValidateIf((o) => o.action_type === EmployeeJobActionType.UNPAID_LEAVE)
  @IsDateString()
  new_unpaid_leave_end_date?: string;

  @IsDateString()
  modification_date: string;

  @IsOptional()
  @IsString()
  observation?: string;
}
