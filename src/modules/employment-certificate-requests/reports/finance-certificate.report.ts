import { Content } from 'pdfmake/interfaces';

const money = (value: number) =>
  `Lps. ${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function financeCertificateContent(data: any): Content[] {
  return [
    {
      text: 'SEÑORES TRIBUNAL SUPERIOR DE CUENTAS',
      bold: true,
      fontSize: 13,
      margin: [0, 28, 0, 24],
    },
    {
      text: [
        { text: 'En Carácter de Director de Recursos Humanos y Capacitaciones del ', fontSize: 11 },
        { text: 'SERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA (SENASA),', bold: true, fontSize: 11 },
        { text: ' ', fontSize: 11 },
        { text: 'HAGO CONSTAR QUE: ', bold: true, fontSize: 11 },
        { text: `${data.employeeName.toUpperCase()},`, bold: true, fontSize: 11 },
        { text: ` labora para esta Institución desde el ${data.financeEntryDate}, bajo la modalidad de `, fontSize: 11 },
        { text: `${data.financeModality},`, bold: true, fontSize: 11 },
        { text: ' desempeñando el cargo nominal de: ', fontSize: 11 },
        { text: data.nominalPosition.toUpperCase(), bold: true, fontSize: 11 },
        { text: ' y cargo funcional de: ', fontSize: 11 },
        { text: `${data.functionalPosition.toUpperCase()},`, bold: true, fontSize: 11 },
        { text: ' devengando un sueldo mensual de: ', fontSize: 11 },
        { text: money(data.grossSalary), bold: true, fontSize: 11 },
        { text: ` (${data.amountInWords}).`, bold: true, fontSize: 11 },
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
