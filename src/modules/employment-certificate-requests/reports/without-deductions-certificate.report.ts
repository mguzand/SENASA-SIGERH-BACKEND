import { Content } from 'pdfmake/interfaces';

const money = (value: number) =>
  `LPS. ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function withoutDeductionsContent(data: any): Content[] {
  return [
    {
      text: 'CONSTANCIA',
      bold: true,
      fontSize: 14,
      alignment: 'center',
      margin: [0, 30, 0, 18],
    },
    {
      text: [
        {
          text: 'En mi condición de Jefe del Departamento de Personal por delegación del ',
          fontSize: 11,
        },
        {
          text: 'SERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA (SENASA),',
          bold: true,
          fontSize: 11,
        },
        { text: ' ', fontSize: 11 },
        { text: 'HAGO CONSTAR QUE: ', bold: true, fontSize: 11 },
        {
          text: `${data.employeeName.toUpperCase()},`,
          bold: true,
          fontSize: 11,
        },
        {
          text: ` labora para esta Institución desde ${data.entryDate}, bajo la modalidad de `,
          fontSize: 11,
        },
        { text: `${data.modality},`, bold: true, fontSize: 11 },
        { text: ' desempeñando el cargo de: ', fontSize: 11 },
        {
          text: `${data.position.toUpperCase()},`,
          bold: true,
          fontSize: 11,
        },
        { text: ' devengando un sueldo mensual de: ', fontSize: 11 },
        { text: money(data.grossSalary), bold: true, fontSize: 11 },
        {
          text: ` (${data.amountInWords}).`,
          bold: true,
          fontSize: 11,
        },
      ],
      alignment: 'justify',
      lineHeight: 2,
      margin: [0, 0, 0, 24],
    },
    {
      text: `Y para los fines que estime conveniente se le extiende la presente en la Ciudad de Tegucigalpa, Municipio del Distrito Central a los ${data.issueDateInWords}.`,
      alignment: 'justify',
      fontSize: 11,
      lineHeight: 2,
    },
  ];
}
