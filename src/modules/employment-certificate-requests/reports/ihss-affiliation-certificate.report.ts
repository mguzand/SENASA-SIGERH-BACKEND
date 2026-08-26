import { Content } from 'pdfmake/interfaces';

import { simpleBorderLayout } from 'src/common/printer/pdf-layout';

export function ihssAffiliationContent(data: any): Content[] {
  return [
    introductoryParagraph(data),
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              text: `El número patronal de SENASA es: ${data.employerNumber}`,
              fontSize: 11,
              bold: true,
              alignment: 'center',
              margin: [10, 10, 10, 10],
              fillColor: '#eef7f7',
            },
          ],
        ],
      },
      layout: simpleBorderLayout,
      margin: [40, 0, 40, 24],
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
          {
            text: ', por medio de la presente ',
            fontSize: 11,
          },
          {
            text: 'HAGO CONSTAR QUE: ',
            bold: true,
            fontSize: 11,
          },
          {
            text: data.employeeName.toUpperCase(),
            bold: true,
            fontSize: 11,
          },
          {
            text: ` con tarjeta de identidad No. ${data.identity}, labora para esta institución bajo la modalidad de `,
            fontSize: 11,
          },
          {
            text: data.modality,
            bold: true,
            fontSize: 11,
          },
          {
            text: ` desde el ${data.entryDate} y cotiza al I.H.S.S., encontrándose activo en esta institución.`,
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


//cambio

function closingParagraph(data: any): Content {
  return {
    text: `Y para los fines que estime convenientes, se extiende la presente en Tegucigalpa, Municipio del Distrito Central, ${data.issueDate}.`,
    alignment: 'justify',
    fontSize: 11,
    margin: [0, 8, 0, 0],
  };
}
