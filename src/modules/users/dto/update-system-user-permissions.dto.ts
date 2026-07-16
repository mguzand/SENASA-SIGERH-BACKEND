import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class SystemPermissionAssignmentDto {
  @IsInt()
  component_id: number;

  @IsOptional()
  @IsUUID()
  systemRoleId?: string;

  // Compatibilidad temporal con clientes anteriores.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  rol?: string;
}

export class UpdateSystemUserPermissionsDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique((item: SystemPermissionAssignmentDto) => item.component_id)
  @ValidateNested({ each: true })
  @Type(() => SystemPermissionAssignmentDto)
  assignments: SystemPermissionAssignmentDto[] = [];
}
