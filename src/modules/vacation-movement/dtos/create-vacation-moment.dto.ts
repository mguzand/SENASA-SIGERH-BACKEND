import { VacationMovementType } from 'src/common/enums/vacation.enums';

export interface CreateVacationMovementDto {
  employeeId: string;
  vacationPeriodId?: string | null;
  vacationRequestId?: string | null;
  type: VacationMovementType;
  days: number;
  movementDate: string;
  description?: string | null;
  createdByUserId?: string | null;
}
