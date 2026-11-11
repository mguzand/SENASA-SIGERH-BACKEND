import { IsDateString, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

export class CreateManualAttendanceDto {
  @IsUUID()
  employeeId: string;

  @IsUUID()
  regionalId: string;

  @IsDateString({ strict: true })
  date: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, {
    message: 'La hora debe tener el formato HH:mm.',
  })
  time: string;
}
