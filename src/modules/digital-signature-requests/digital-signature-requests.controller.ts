import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CreateDigitalSignatureRequestDto } from './dto/create-digital-signature-request.dto';
import { ListDigitalSignatureRequestsDto } from './dto/list-digital-signature-requests.dto';
import { DigitalSignatureRequestsService } from './digital-signature-requests.service';

@Controller('digital-signature-requests')
export class DigitalSignatureRequestsController {
  constructor(private readonly service: DigitalSignatureRequestsService) {}
  @Public() @Get('public/employee/:identity') lookup(@Param('identity') identity: string) { return this.service.lookup(identity); }
  @Public() @Post('public') create(@Body() dto: CreateDigitalSignatureRequestDto) { return this.service.create(dto); }
  @Get() findAll(@Query() query: ListDigitalSignatureRequestsDto, @Req() req: any) { return this.service.findAll(query, req.user?.username); }
  @Get(':id/document/:type') async document(@Param('id') id: string, @Param('type') type: 'front' | 'back' | 'selfie', @Req() req: any, @Res() res: Response) {
    const file = await this.service.getDocument(id, type, req.user?.username);
    res.type(file.mimeType); res.setHeader('Cache-Control', 'private, no-store'); return res.sendFile(file.absolutePath);
  }
}
