import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as QRCode from 'qrcode';
import { join } from 'path';

import { defaultPdfConfig } from 'src/common/printer/pdf-theme';
import { EmploymentCertificateType } from '../enums/employment-certificate-type.enum';
import { embassyContent } from './embassy-certificate.report';
import { ihssAffiliationContent } from './ihss-affiliation-certificate.report';
import { injupempAffiliationContent } from './injupemp-affiliation-certificate.report';
import { siafiPinContent } from './siafi-pin-certificate.report';
import { withDeductionsContent } from './with-deductions-certificate.report';
import { withoutDeductionsContent } from './without-deductions-certificate.report';

export async function EmploymentCertificateReport(
  data: any,
): Promise<TDocumentDefinitions> {
  const qr = await QRCode.toDataURL(data.validationUrl);
  const body = certificateContent(data);

  return {
    ...defaultPdfConfig,
    pageMargins: [80, 30, 80, 112],
    pageSize: 'LETTER',
    defaultStyle: {
      font: 'Georgias',
      fontSize: 10,
      lineHeight: 1.35,
    },

    content: [header(data), ...body],
    footer: (currentPage, pageCount) => ({
      margin: [42, 0, 42, 10],
      columns: [
        {
          width: 145,
          stack: [
            { image: qr, fit: [46, 46], alignment: 'left' },
            {
              text: 'Documento verificable mediante código QR',
              bold: true,
              fontSize: 6,
            },
            {
              text: `Emitido por SIGERH · ${data.printedAt}`,
              fontSize: 5.5,
              color: '#475569',
            },
            {
              text: `Código: ${data.documentNumber}`,
              fontSize: 5.5,
              color: '#475569',
            },
          ],
        },
        {
          width: '*',
          alignment: 'center',
          stack: [
            {
              image: join(__dirname, '../../leave-requests/assets/hr-signature.png'),
              width: 155,
              alignment: 'center',
              margin: [0, 0, 0, 0],
            },
            {
              text: data.signerName,
              bold: true,
              fontSize: 7.5,
              alignment: 'center',
              margin: [0, -9, 0, 0],
            },
            { text: data.signerTitle, fontSize: 7, alignment: 'center' },
            {
              text: data.delegationMemo,
              fontSize: 5.5,
              color: '#475569',
              alignment: 'center',
              margin: [0, 1, 0, 0],
            },
          ],
        },
        {
          width: 45,
          text: `${currentPage}/${pageCount}`,
          alignment: 'right',
          fontSize: 6,
        },
      ],
    }),
  };
}

function certificateContent(data: any): Content[] {
  switch (data.type) {
    case EmploymentCertificateType.WITH_DEDUCTIONS:
      return withDeductionsContent(data);
    case EmploymentCertificateType.WITHOUT_DEDUCTIONS:
      return withoutDeductionsContent(data);
    case EmploymentCertificateType.IHSS_AFFILIATION:
      return ihssAffiliationContent(data);
    case EmploymentCertificateType.INJUPEMP_AFFILIATION:
      return injupempAffiliationContent(data);
    case EmploymentCertificateType.EMBASSY:
      return embassyContent(data);
    case EmploymentCertificateType.SIAFI_PIN:
      return siafiPinContent(data);
    default:
      throw new Error(`No existe una plantilla PDF para ${data.type}.`);
  }
}

function header(data: any): Content {
  return {
    columns: [
      { width: 235, image: 'assets/logo_goboerno.png', fit: [235, 78] },
      { width: '*', text: '' },
      {
        width: 150,
        stack: [
          ...([
            EmploymentCertificateType.INJUPEMP_AFFILIATION,
            EmploymentCertificateType.EMBASSY,
            EmploymentCertificateType.SIAFI_PIN,
          ].includes(data.type)
            ? []
            : [
                {
                  text: 'CONSTANCIA LABORAL',
                  bold: true,
                  fontSize: 11,
                  alignment: 'right' as const,
                  color: '#163f46',
                },
              ]),
          {
            text: `${
              [
                EmploymentCertificateType.INJUPEMP_AFFILIATION,
                EmploymentCertificateType.EMBASSY,
                EmploymentCertificateType.SIAFI_PIN,
              ].includes(data.type)
                ? 'Nº'
                : 'No.'
            } ${data.documentNumber}`,
            bold: true,
            fontSize: 8,
            alignment: 'right',
            margin: [
              0,
              [
                EmploymentCertificateType.INJUPEMP_AFFILIATION,
                EmploymentCertificateType.EMBASSY,
                EmploymentCertificateType.SIAFI_PIN,
              ].includes(data.type)
                ? 28
                : 5,
              0,
              0,
            ],
          },
        ],
      },
    ],
    margin: [0, 0, 0, 12],
  };
}
