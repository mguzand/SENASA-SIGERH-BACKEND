import { IsEmail, IsIn, IsNotEmpty, IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateDigitalSignatureRequestDto {
  @IsString() @Matches(/^\d{13}$/) identity: string;
  @IsString() @IsNotEmpty() @MaxLength(220) fullName: string;
  @IsEmail() @MaxLength(150) email: string;
  @IsString() @Length(8, 30) phone: string;
  @IsString() @IsNotEmpty() identityFrontBase64: string;
  @IsIn(['image/png', 'image/jpeg', 'image/webp']) identityFrontMimeType: string;
  @IsString() @IsNotEmpty() identityBackBase64: string;
  @IsIn(['image/png', 'image/jpeg', 'image/webp']) identityBackMimeType: string;
  @IsString() @IsNotEmpty() selfieBase64: string;
  @IsIn(['image/png', 'image/jpeg', 'image/webp']) selfieMimeType: string;
}
