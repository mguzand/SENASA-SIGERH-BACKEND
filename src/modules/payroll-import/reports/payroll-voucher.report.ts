import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import * as QRCode from 'qrcode';
import { join } from 'path';
import {
  noBorderLayout,
  simpleBorderLayout,
} from 'src/common/printer/pdf-layout';
import { defaultPdfConfig } from 'src/common/printer/pdf-theme';

const money = (value: number) =>
  Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export async function PayrollVoucherReport(
  data: any,
): Promise<TDocumentDefinitions> {
  const qr = await QRCode.toDataURL(data.validationUrl ?? `SIGERH-${data.id}`);

  const deductions = data.deductions ?? [];
  const withholdings = data.withholdings ?? [];

  const content: Content[] = [
    header(data),

    sectionTitle(
      data.regionalName === 'TEGUCIGALPA' ? `SENASA` : 'OFICINA REGIONAL',
      data.regionalName ?? '-',
    ),

    sectionTitle('A. INFORMACIÓN DEL EMPLEADO'),

    {
      table: {
        widths: [120, '*', 110, '*'],
        body: [
          [
            { text: 'EMPLEADO', style: 'label' },
            { text: data.employeeName ?? '-', style: 'text' },
            { text: 'FECHA DE INGRESO', style: 'label' },
            { text: data.entryDate ?? '-', style: 'text' },
          ],
          [
            { text: 'PUESTO', style: 'label' },
            { text: data.position ?? '-', style: 'text', colSpan: 3 },
            {},
            {},
          ],
          [
            { text: 'UNIDAD ORGANIZACIONAL', style: 'label' },
            { text: data.organizationalUnit ?? '-', style: 'text', colSpan: 3 },
            {},
            {},
          ],
          [
            { text: 'GRUPO NIVEL', style: 'label' },
            { text: data.groupLevel ?? '-', style: 'text' },
            { text: 'IDENTIDAD', style: 'label' },
            { text: data.identity ?? '-', style: 'text' },
          ],
          [
            { text: 'CLASE / TIPO PLANILLA', style: 'label' },
            { text: data.payrollType ?? '-', style: 'text', colSpan: 3 },
            {},
            {},
          ],
        ],
      },
      layout: simpleBorderLayout,
    },

    sectionTitle('B. DETALLE DEL PAGO'),
    subSectionTitle('B.1. SUELDO BRUTO'),

    {
      table: {
        widths: ['*', '*', '*', '*', '*'],
        body: [
          [
            {
              text: 'SALARIO ORDINARIO',
              style: 'tableHeader',
              alignment: 'center',
            },
            { text: 'INCREMENTOS', style: 'tableHeader', alignment: 'center' },
            { text: 'ANTIGÜEDAD', style: 'tableHeader', alignment: 'center' },
            {
              text: 'SALARIO INTEGRAL',
              style: 'tableHeader',
              alignment: 'center',
            },
            { text: 'SALARIO NETO', style: 'tableHeader', alignment: 'center' },
          ],
          [
            { text: money(data.ordinarySalary), style: 'amount' },
            { text: money(data.increments), style: 'amount' },
            { text: money(data.seniority), style: 'amount' },
            { text: money(data.integralSalary), style: 'amount' },
            { text: money(data.netSalary), style: 'amount' },
          ],
        ],
      },
      layout: simpleBorderLayout,
      margin: [0, 2, 0, 4],
    },

    {
      table: {
        widths: [45, '*'],
        body: [
          [
            { text: 'SON:', style: 'label' },
            { text: data.amountInWords ?? '-', style: 'text', bold: true },
          ],
          [
            { text: 'BANCO:', style: 'label' },
            { text: data.bankName ?? '-', style: 'text' },
          ],
          [
            { text: 'CUENTA:', style: 'label' },
            { text: data.bankAccount ?? '-', style: 'text' },
          ],
        ],
      },
      layout: simpleBorderLayout,
      margin: [0, 0, 0, 4],
    },

    subSectionTitle('B.2. DEDUCCIONES Y RETENCIONES'),

    itemsTable('DEDUCCIONES', deductions, data.deductionsTotal),
    itemsTable('RETENCIONES', withholdings, data.withholdingsTotal),

    totals(data),

    signature(data),
    // footer(data, qr),
  ];

  return {
    ...defaultPdfConfig,
    content,
    footer: (currentPage, pageCount) => {
      return {
        margin: [30, 0, 0, 15],

        columns: [
          {
            width: 60,
            image: qr,
            fit: [50, 50],
            margin: [0, -30, 0, 0],
          },

          {
            width: '*',
            margin: [10, -10, 0, 0],
            stack: [
              {
                text: 'Emitido por: Sistema de Recursos Humanos SIGERH',
                fontSize: 7,
              },
              {
                text: `Fecha de impresión: ${data.printedAt}`,
                fontSize: 7,
              },
            ],
          },

          {
            width: 80,
            text: `Página ${currentPage} de ${pageCount}`,
            alignment: 'right',
            fontSize: 7,
            margin: [15, -5, 20, 10],
          },
        ],
      };
    },
  };
}

function signature(data: any): Content {
  return {
    stack: [
      {
        image: join(__dirname, '../../leave-requests/assets/hr-signature.png'),
        width: 115,
        alignment: 'center',
        margin: [0, 0, 0, -7],
      },
      {
        text: 'ING. KEVIN ERNESTO MENDOZA LIRA',
        alignment: 'center',
        bold: true,
        fontSize: 7,
      },
      {
        text: 'DIRECTOR DE RECURSOS HUMANOS Y CAPACITACIÓN DEL SENASA',
        alignment: 'center',
        fontSize: 6.5,
      },
    ],
    margin: [0, 24, 0, 20],
  };
}

function header(data: any): Content {
  return {
    columns: [
      {
        width: 230,
        image: 'assets/logo_goboerno.png',
        fit: [240, 80],
      },
      {
        width: '*',
        text: '',
      },
      {
        width: 170,
        stack: [
          {
            text: 'COMPROBANTE DE PAGO',
            style: 'title',
          },
          {
            text: `No. ${data.documentNumber ?? '-'}`,
            alignment: 'right',
            bold: true,
            fontSize: 8,
          },
          {
            text: `Mes: ${data.month ?? '-'}`,
            alignment: 'right',
            fontSize: 8,
          },
          {
            text: `Gestión ${data.year ?? '-'}`,
            alignment: 'right',
            fontSize: 8,
          },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

function sectionTitle(label: string, value?: string): Content {
  return {
    table: {
      widths: value ? [95, '*'] : ['*'],
      body: [
        value
          ? [
              { text: label, style: 'section' },
              { text: value, style: 'text', margin: [4, 2, 4, 2] },
            ]
          : [{ text: label, style: 'section' }],
      ],
    },
    layout: simpleBorderLayout,
  };
}

function subSectionTitle(text: string): Content {
  return {
    table: {
      widths: ['*'],
      body: [[{ text, style: 'subSection' }]],
    },
    layout: simpleBorderLayout,
  };
}

function itemsTable(title: string, items: any[], total: number): Content {
  const rows =
    items.length > 0
      ? items.map((item) => [
          { text: item.code ?? '-', style: 'text' },
          { text: item.description ?? '-', style: 'text' },
          { text: money(item.amount), style: 'amount' },
        ])
      : [
          [
            { text: '-', style: 'text' },
            { text: 'SIN REGISTROS', style: 'text' },
            { text: '0.00', style: 'amount' },
          ],
        ];

  return {
    table: {
      widths: [55, '*', 80],
      body: [
        [
          {
            text: title,
            style: 'tableHeader',
            colSpan: 3,
            alignment: 'left',
            fillColor: '#eeeeee',
          },
          {},
          {},
        ],
        [
          { text: 'CÓDIGO', style: 'tableHeader' },
          { text: 'DESCRIPCIÓN', style: 'tableHeader' },
          { text: 'VALOR (L.)', style: 'tableHeader', alignment: 'right' },
        ],
        ...rows,
        [
          { text: `SUB TOTAL ${title}`, style: 'totalLabel', colSpan: 2 },
          {},
          { text: money(total), style: 'totalAmount' },
        ],
      ],
    },
    layout: noBorderLayout,
    margin: [18, 2, 18, 4],
  };
}

function totals(data: any): Content {
  return {
    table: {
      widths: ['*', 100],
      body: [
        [
          {
            text: 'TOTAL DEDUCCIONES + RETENCIONES DEL MES',
            style: 'totalLabel',
          },
          {
            text: money(data.totalDeductionsWithholdings),
            style: 'totalAmount',
          },
        ],
        [
          {
            text: `TOTAL A NETO PAGAR CORRESPONDIENTE AL MES DE ${data.month ?? ''} DE ${data.year ?? ''}`,
            style: 'totalLabel',
            fillColor: '#d9eeee',
          },
          {
            text: money(data.netSalary),
            style: 'totalAmount',
            fillColor: '#d9eeee',
          },
        ],
      ],
    },
    layout: simpleBorderLayout,
    margin: [0, 2, 0, 4],
  };
}

function footer(data: any, qr: string): Content {
  return {
    columns: [
      {
        width: 70,
        image: qr,
        fit: [58, 58],
      },
      {
        width: '*',
        stack: [
          {
            text: 'Emitido por: Sistema de Recursos Humanos SIGERH',
            fontSize: 7,
          },
          {
            text: `Fecha de impresión: ${data.printedAt ?? ''}`,
            fontSize: 7,
          },
        ],
        margin: [8, 18, 0, 0],
      },
    ],
    margin: [0, 4, 0, 0],
  };
}
