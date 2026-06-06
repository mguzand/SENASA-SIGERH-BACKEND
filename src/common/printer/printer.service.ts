import { Injectable } from '@nestjs/common';

const PdfPrinter = require('pdfmake');

const fonts = {
  Roboto: {
    normal: 'fonts/Roboto-Regular.ttf',
    bold: 'fonts/Roboto-Medium.ttf',
    italics: 'fonts/Roboto-Italic.ttf',
    bolditalics: 'fonts/Roboto-MediumItalic.ttf',
  },
};

@Injectable()
export class PrinterService {
  private readonly printer = new PdfPrinter(fonts);

  createPdf(docDefinition: any) {
    return this.printer.createPdfKitDocument(docDefinition);
  }
}
