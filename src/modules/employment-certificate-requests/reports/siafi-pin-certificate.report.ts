import { Content } from 'pdfmake/interfaces';

export function siafiPinContent(data: any): Content[] {
  return [
    {
      text: 'SEÑORES FINANZAS',
      bold: true,
      fontSize: 14,
      margin: [0, 30, 0, 24],
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
        { text: 'HAGO CONSTAR QUE: ', bold: true, fontSize: 11 },
        {
          text: data.employeeName.toUpperCase(),
          bold: true,
          fontSize: 11,
        },
        {
          text: ` labora para esta Institución desde el ${data.entryDate}, bajo la modalidad de `,
          fontSize: 11,
        },
        { text: data.modality, bold: true, fontSize: 11 },
        { text: ' y desempeñando el cargo de ', fontSize: 11 },
        {
          text: `${data.position.toUpperCase()}.`,
          bold: true,
          fontSize: 11,
        },
      ],
      alignment: 'justify',
      lineHeight: 2,
      margin: [0, 0, 0, 20],
    },
    {
      text: `Y para los fines que estime conveniente se le extiende la presente en la Ciudad de Tegucigalpa, Municipio del Distrito Central, ${data.issueDate}.`,
      alignment: 'justify',
      fontSize: 11,
      lineHeight: 2,
    },
  ];
}
