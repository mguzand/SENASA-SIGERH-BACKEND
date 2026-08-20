import { join } from 'path';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { LeaveRequest } from '../entities/leave-request.entity';
import { LeaveReasonType, LeaveRequestType } from '../enums/leave-request.enums';

const employeeName = (request: LeaveRequest) =>
  [
    request.employee?.firstName,
    request.employee?.middleName,
    request.employee?.lastName,
    request.employee?.secondLastName,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

export const buildLeaveRequestReport = (
  request: LeaveRequest,
  destination: 'HR' | 'DIRECTOR',
): TDocumentDefinitions => {
  const destinationName = destination === 'HR'
    ? 'JEFATURA DE RECURSOS HUMANOS Y CAPACITACIÓN'
    : 'DR. RAFAEL ENRIQUE RODRÍGUEZ ALVARADO\nDIRECTOR GENERAL DEL SENASA';
  const origin = destination === 'HR'
    ? employeeName(request)
    : 'DIRECCIÓN DE RECURSOS HUMANOS Y CAPACITACIÓN DEL SENASA';
  const paidLabel = request.type === LeaveRequestType.PAID
    ? 'LICENCIA REMUNERADA'
    : 'LICENCIA NO REMUNERADA';
  const legalBasis: Record<LeaveReasonType, string> = {
    [LeaveReasonType.DEATH]: 'Fundamentando la petición del colaborador en el ARTÍCULO 130.- REGLAMENTO DE LA LEY CIVIL: LICENCIAS REMUNERADAS, numeral 2: a) 2- Por duelo: si hubiere fallecido uno de los padres del servidor o uno de sus hijos, hermanos, cónyuge o compañera o compañero de hogar, se concederán cinco (5) días hábiles; si el fallecido hubiere habitado en lugar diferente al domicilio del servidor, se podrán conceder hasta nueve (9) días hábiles, atendiendo la distancia y demás circunstancias.',
    [LeaveReasonType.PERSONAL]: 'Fundamentando la petición del colaborador en el artículo 136 del REGLAMENTO DE LA LEY DE SERVICIO CIVIL: LICENCIAS NO REMUNERADAS, numeral 6: Otras circunstancias calificadas en las que prevalezca el interés personal del servidor y no el de la Administración Pública, siempre que no se ponga en precario el servicio.',
    [LeaveReasonType.IHSS]: 'Fundamentando la petición del colaborador en el artículo 134 del REGLAMENTO DE LA LEY DE SERVICIO CIVIL: LICENCIAS REMUNERADAS, numeral 4: La enfermedad grave de cualquiera de los padres, hijos, hermanos, cónyuge o compañera o compañero de hogar del servidor, previa acreditación mediante certificación médica y evidencia de que fuere imprescindible su asistencia.',
  };

  return {
    pageSize: 'LETTER',
    pageMargins: [55, 60, 55, 48],
    defaultStyle: { font: 'Georgias', fontSize: 10.5, lineHeight: 1.15 },
    content: [
      { text: request.requestNumber, alignment: 'center', bold: true, margin: [0, 0, 0, 28] },
      { columns: [{ width: 70, text: 'PARA:', bold: true }, { text: destinationName, bold: true }] },
      { columns: [{ width: 70, text: 'DE:', bold: true }, { text: origin, bold: true }], margin: [0, 34, 0, 0] },
      { columns: [{ width: 70, text: 'ASUNTO:', bold: true }, { text: paidLabel, bold: true }], margin: [0, 28, 0, 0] },
      { columns: [{ width: 70, text: 'FECHA:', bold: true }, { text: new Intl.DateTimeFormat('es-HN', { dateStyle: 'long' }).format(new Date()), bold: true }], margin: [0, 10, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 500, y2: 0, lineWidth: 2, lineColor: '#5b9bd5' }], margin: [0, 0, 0, 14] },
      { text: [{ text: 'Vista la solicitud presentada por el colaborador ' }, { text: employeeName(request), bold: true }, { text: `, quien solicita ${paidLabel.toLowerCase()} por ${request.businessDays} día(s) hábil(es), del ${request.startDate} al ${request.endDate}, por el siguiente motivo: ${request.reason}.` }], alignment: 'justify' },
      { text: legalBasis[request.reasonType], alignment: 'justify', margin: [0, 14, 0, 0] },
      { text: [{ text: 'La Dirección de Recursos Humanos y Capacitación, basada en el artículo precedente, opina lo siguiente: ' }, { text: `Que se proceda a otorgar ${paidLabel.toLowerCase()} al colaborador ${employeeName(request)}, por el período solicitado.`, bold: true }], alignment: 'justify', margin: [0, 14, 0, 0] },
      { image: join(__dirname, '../assets/hr-signature.png'), width: 190, alignment: 'center', margin: [0, 26, 0, 0] },
      { text: 'DIRECCIÓN DE RECURSOS HUMANOS Y CAPACITACIÓN\nSERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA', bold: true, alignment: 'center', fontSize: 9, margin: [0, -8, 0, 0] },
      { text: 'Cc: Archivo', fontSize: 9, margin: [0, 18, 0, 0] },
    ],
  };
};
