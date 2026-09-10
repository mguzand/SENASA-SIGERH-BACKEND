import { ArrayMinSize, IsArray, IsDateString } from 'class-validator';

export class UpdateLiaisonVacationDaysDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsDateString({}, { each: true })
  days: string[];
}
