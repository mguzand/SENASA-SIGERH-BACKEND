import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class PublicCriminalRecordUpdateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  originalName: string;

  @IsString()
  @Matches(/^pdf$/i, { message: 'Solo se permiten archivos PDF.' })
  extension: string;

  @IsString()
  @Matches(/^application\/pdf$/i, { message: 'El archivo debe ser un PDF.' })
  mimeType: string;

  @IsString()
  @IsNotEmpty()
  base64: string;

  @IsDateString({}, { message: 'La fecha de vencimiento no es válida.' })
  expirationDate: string;
}
