import { IsDateString, IsNotEmpty } from 'class-validator';

export class UpdateDocumentExpirationDto {
  @IsNotEmpty()
  @IsDateString({}, { message: 'La fecha de vencimiento no es válida.' })
  expirationDate: string;
}
