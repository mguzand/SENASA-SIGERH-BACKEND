import { Content } from 'pdfmake/interfaces';

const money = (value: number) =>
  `L. ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function embassyContent(data: any): Content[] {
  const employmentHistory = data.hasContractToAgreementTransition
    ? [
        {
          text: ` labora para esta Institución desde el ${data.entryDate}, bajo la modalidad de `,
          fontSize: 11,
        },
        { text: 'Contrato', bold: true, fontSize: 11 },
        {
          text: ' (no es considerado para antigüedad) y a partir del ',
          fontSize: 11,
        },
        { text: data.agreementDate, bold: true, fontSize: 11 },
        { text: ' bajo la modalidad de ', fontSize: 11 },
        { text: 'Acuerdo', bold: true, fontSize: 11 },
      ]
    : [
        {
          text: ` labora para esta Institución desde el ${data.entryDate}, bajo la modalidad de `,
          fontSize: 11,
        },
        { text: data.modality, bold: true, fontSize: 11 },
      ];

  return [
    {
      text: String(data.embassyName).toUpperCase(),
      bold: true,
      fontSize: 14,
      margin: [0, 30, 0, 24],
    },
    {
      text: [
        {
          text: 'En Carácter de Director de Recursos Humanos y Capacitación del ',
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
        ...employmentHistory,
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
      text: [
        {
          text: 'La presente constancia se emite para ser presentada ante ',
          fontSize: 11,
        },
        {
          text: String(data.embassyName).toUpperCase(),
          bold: true,
          fontSize: 11,
        },
        { text: ', con cita programada para el ', fontSize: 11 },
        { text: data.appointmentDate, bold: true, fontSize: 11 },
        { text: '.', fontSize: 11 },
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
    },
  ];
}
