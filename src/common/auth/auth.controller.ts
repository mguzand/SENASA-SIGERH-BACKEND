import {
  Controller,
  Post,
  UseGuards,
  Request,
  Body,
  Patch,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../decorators/public.decorator';
import { ResetPasswordDto } from './interfaces/resetPassword.dto';
import { RequestPasswordResetOtpDto } from './dto/request-password-reset-otp.dto';
import { ConfirmPasswordResetOtpDto } from './dto/confirm-password-reset-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly _authService: AuthService) {}

  @Public()
  @Post('login')
  @UseGuards(AuthGuard('local'))
  async loginEmployee(@Request() req) {
    return this._authService.login(req.user);
  }

  @Public()
  @Post('request-password-reset-otp')
  async requestPasswordResetOtp(@Body() dto: RequestPasswordResetOtpDto) {
    return this._authService.requestPasswordResetOtp(dto.identifier);
  }

  @Public()
  @Post('confirm-password-reset-otp')
  async confirmPasswordResetOtp(@Body() dto: ConfirmPasswordResetOtpDto) {
    return this._authService.confirmPasswordResetOtp(
      dto.identifier,
      dto.code,
      dto.new_password,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto, @Request() req) {
    return await this._authService.resetPassword(
      req.user.username,
      dto.new_password,
    );
  }
}
