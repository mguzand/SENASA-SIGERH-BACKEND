import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VacationRequestStatus } from 'src/common/enums/vacation.enums';

export class ReviewVacationRequestDto {
  @IsEnum(VacationRequestStatus)
  status: VacationRequestStatus.APPROVED | VacationRequestStatus.REJECTED;

  @IsOptional()
  @IsString()
  observation?: string;
}
