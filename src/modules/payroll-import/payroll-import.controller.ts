import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Req,
  Param,
  Res,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PayrollImportService } from './payroll-import.service';
import type { Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { Query } from '@nestjs/common';
import { ListPayrollReceiptsDto } from './dto/list-payroll-receipts.dto';

@Controller('payroll-imports')
export class PayrollImportController {
  constructor(private readonly payrollImportService: PayrollImportService) {}

  @Get('receipts')
  async listReceipts(@Query() query: ListPayrollReceiptsDto) {
    return this.payrollImportService.listReceipts(query);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPayrollPdf(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Debe subir un archivo PDF');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('El archivo debe ser PDF');
    }

    return this.payrollImportService.processPayrollPdf({
      file,
      userId: req.user?.id,
    });
  }

  @Public()
  @Get('receipts/:id/pdf')
  async downloadVoucherPdf(@Param('id') id: string, @Res() res: Response) {
    const pdfDoc = await this.payrollImportService.generateVoucherPdf(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="comprobante-${id}.pdf"`,
    );

    pdfDoc.pipe(res);
    pdfDoc.end();
  }
}
