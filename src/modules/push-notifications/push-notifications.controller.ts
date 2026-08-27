import { Body, Controller, Post, Req } from '@nestjs/common';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PushNotificationsService } from './push-notifications.service';

class RegisterPushDeviceDto {
  @IsString() @IsNotEmpty() token: string;
  @IsIn(['android', 'ios', 'web']) platform: string;
}

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(private readonly service: PushNotificationsService) {}

  @Post('devices')
  register(@Req() request: any, @Body() dto: RegisterPushDeviceDto) {
    return this.service.register(request.user.id || request.user.sub, dto.token, dto.platform);
  }
}
