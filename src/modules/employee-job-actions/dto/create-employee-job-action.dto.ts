import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmployeeJobActionType } from '../enums/employee-job-action-type.enum';

export class CreateEmployeeJobActionDto {
  @IsUUID()
  employee_id: string;

  @IsEnum(EmployeeJobActionType)
  action_type: EmployeeJobActionType;

  @IsUUID()
  new_modality_id: string;

  @IsDateString()
  modification_date: string;

  @IsOptional()
  @IsString()
  observation?: string;
}
