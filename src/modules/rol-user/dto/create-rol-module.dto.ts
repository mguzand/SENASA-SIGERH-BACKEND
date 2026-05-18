 
import { Transform, Type } from "class-transformer";
import { IsArray, IsInt, IsNotEmpty, IsNumberString, ValidateNested } from "class-validator";




class RolUserModuleDto{
  


  //--------------------------Validar  Modulo de tipo string y no nulo-------------------------//
  @IsNotEmpty({ message: 'Se debe especificar la id_modulo del usuario.'})
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  id_modulo: number;

  //--------------------------Validar  Modulo de tipo string y no nulo-------------------------//
  @IsNotEmpty({ message: 'Se debe especificar la id_modulo del usuario.'})
  rol: string;


}

export class CreateRolUserModuleDto{
  //-------------------------------Validar Array y validar campo-------------------------------//
  @IsArray({ message: 'Los roles deben de ser un arreglo.' })
  @ValidateNested({ each: true })
  @Type(() => RolUserModuleDto)
  Roles: RolUserModuleDto[];

  //---------------Validar Identidad que tenga datos y que solo contenga numeros---------------//
  @IsNotEmpty({ message: 'Se debe especificar la identidad del usuario.'})
  @IsInt()
  @Transform(({ value }) => parseInt(value))
  user_id: number;
}
 
