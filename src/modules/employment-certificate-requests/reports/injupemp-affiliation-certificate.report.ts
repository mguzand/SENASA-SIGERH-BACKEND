import { Content } from 'pdfmake/interfaces';

const money = (value: number) =>
  `Lps. ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function injupempAffiliationContent(data: any): Content[] {
  return [
    {
      text: 'CONSTANCIA',
      bold: true,
      fontSize: 14,
      characterSpacing: 3,
      alignment: 'center',
      margin: [0, 30, 0, 14],
    },
    {
      text: [
        {
          text: 'En Carácter de Director de Recursos Humanos y Capacitaciones del ',
          fontSize: 11,
        },
        {
          text: 'SERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA (SENASA), ',
          bold: true,
          fontSize: 11,
        },
        { text: 'HAGO CONSTAR QUE: ', fontSize: 11 },
        {
          text: data.employeeName.toUpperCase(),
          bold: true,
          fontSize: 11,
        },
        {
          text: ` labora para esta Institución desde el ${data.entryDate} bajo la modalidad de `,
          fontSize: 11,
        },
        { text: data.modality, bold: true, fontSize: 11 },
        { text: ', desempeñando el cargo de: ', fontSize: 11 },
        {
          text: data.position.toUpperCase(),
          bold: true,
          fontSize: 11,
        },
        { text: ', devengando un sueldo mensual de ', fontSize: 11 },
        { text: money(data.grossSalary), bold: true, fontSize: 11 },
        {
          text: ` (${String(data.amountInWords).toUpperCase()}).`,
          bold: true,
          fontSize: 11,
        },
      ],
      alignment: 'justify',
      lineHeight: 2,
      margin: [0, 0, 0, 18],
    },
    {
      text: `Y para los fines que estime conveniente se le extiende la presente en la Ciudad de Tegucigalpa, Municipio del Distrito Central, ${data.issueDate}.`,
      alignment: 'justify',
      fontSize: 11,
      lineHeight: 2,
      margin: [0, 0, 0, 0],
    },
  ];
}
