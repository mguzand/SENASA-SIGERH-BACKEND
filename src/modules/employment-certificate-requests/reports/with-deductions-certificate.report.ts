import { Content } from 'pdfmake/interfaces';

import { simpleBorderLayout } from 'src/common/printer/pdf-layout';

const money = (value: number) =>
  `L. ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function withDeductionsContent(data: any): Content[] {
  const deductions = data.deductions?.length
    ? data.deductions.map((item: any) => [
        { text: item.description, fontSize: 8 },
        { text: money(item.amount), fontSize: 8, alignment: 'right' },
      ])
    : [
        [
          { text: 'SIN DEDUCCIONES REGISTRADAS', fontSize: 8 },
          { text: money(0), fontSize: 8, alignment: 'right' },
        ],
      ];

  return [
    introductoryParagraph(data),
    {
      text: [
       // {
       //   text: ` labora para esta institución desde el ${data.entryDate}, bajo la modalidad de `,
       //   fontSize: 11,
       // },
       // { text: data.modality, bold: true, fontSize: 11 },
        { text: 'Desempeñando el cargo de ', fontSize: 11 },
        { text: data.position.toUpperCase(), bold: true, fontSize: 11 },
        { text: ', con un salario mensual de ', fontSize: 11 },
        { text: money(data.grossSalary), bold: true, fontSize: 11 },
        { text: ` (${data.amountInWords})`, bold: true, fontSize: 11 },
        ', sujeto a las siguientes deducciones:',
      ],
      alignment: 'justify',
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        headerRows: 1,
        widths: ['*', 95],
        body: [
          [
            {
              text: 'DEDUCCIÓN / RETENCIÓN',
              bold: true,
              fontSize: 8,
              fillColor: '#d9eeee',
            },
            {
              text: 'VALOR',
              bold: true,
              fontSize: 8,
              alignment: 'right',
              fillColor: '#d9eeee',
            },
          ],
          ...deductions,
          [
            { text: 'TOTAL DEDUCCIONES', bold: true, fontSize: 8 },
            {
              text: money(data.totalDeductions),
              bold: true,
              fontSize: 8,
              alignment: 'right',
            },
          ],
          [
            {
              text: 'SALARIO NETO',
              bold: true,
              fontSize: 8,
              fillColor: '#eef7f7',
            },
            {
              text: money(data.netSalary),
              bold: true,
              fontSize: 8,
              alignment: 'right',
              fillColor: '#eef7f7',
            },
          ],
        ],
      },
      layout: simpleBorderLayout,
      margin: [15, 0, 15, 20],
    },
    closingParagraph(data),
  ];
}

function introductoryParagraph(data: any): Content {
  return {
    stack: [
      {
        text: 'CONSTANCIA',
        bold: true,
        fontSize: 14,
        alignment: 'center',
        margin: [0, 0, 0, 14],
      },
      {
        text: [
          {
            text: 'En mi condición de Jefe del Departamento de Personal por delegación del ',
            fontSize: 11,
          },
          {
            text: 'SERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA (SENASA)',
            bold: true,
            fontSize: 11,
          },
          { text: ', por medio de la presente ', fontSize: 11 },
          { text: 'HAGO CONSTAR QUE: ', bold: true, fontSize: 11 },
          {
            text: data.employeeName.toUpperCase(),
            bold: true,
            fontSize: 11,
          },
          {
            text: ` con tarjeta de identidad No. ${data.identity}, labora para esta institución bajo la modalidad de `,
            fontSize: 11,
          },
          { text: data.modality, bold: true, fontSize: 11 },
          {
            text: ` desde el ${data.entryDate}, encontrándose activo en esta institución.`,
            fontSize: 11,
          },
        ],
        alignment: 'justify',
        lineHeight: 2,
      },
    ],
    margin: [0, 30, 0, 12],
  };
}

function closingParagraph(data: any): Content {
  return {
    text: `Y para los fines que estime convenientes, se extiende la presente en Tegucigalpa, Municipio del Distrito Central, ${data.issueDate}.`,
    alignment: 'justify',
    fontSize: 11,
    margin: [0, 8, 0, 0],
  };
}
