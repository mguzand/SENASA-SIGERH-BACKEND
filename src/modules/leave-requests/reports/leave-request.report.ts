import { join } from 'path';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { LeaveRequest } from '../entities/leave-request.entity';
import {
  LeaveReasonType,
  LeaveRequestType,
} from '../enums/leave-request.enums';

export type LeavePdfDestination = 'HR' | 'DIRECTOR' | 'FINAL';
const DIRECTOR = 'DR. RAFAEL ENRIQUE RODRIGUEZ ALVARADO';
const DIRECTOR_TITLE = 'DIRECTOR GENERAL DEL SENASA';
const HR_DIRECTOR = 'ING. KEVIN ERNESTO MENDOZA LIRA';
const HR_TITLE = 'DIRECTOR DE RECURSOS HUMANOS Y CAPACITACION DEL SENASA';

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
const leaveLabel = (request: LeaveRequest) =>
  request.type === LeaveRequestType.PAID
    ? 'LICENCIA REMUNERADA'
    : 'LICENCIA NO REMUNERADA';
const legalBasis = (request: LeaveRequest) =>
  ({
    [LeaveReasonType.DEATH]:
      'Fundamentando la petición del colaborador en el ARTÍCULO 130.- REGLAMENTO DE LA LEY CIVIL: LICENCIAS REMUNERADAS, numeral 2: a) 2- Por duelo: si hubiere fallecido uno de los padres del servidor o uno de sus hijos, hermanos, cónyuge o compañera o compañero de hogar, se concederán cinco (5) días hábiles; si el fallecido hubiere habitado en lugar diferente al domicilio del servidor, se podrán conceder hasta nueve (9) días hábiles, atendiendo la distancia y demás circunstancias.',
    [LeaveReasonType.PERSONAL]:
      'Fundamentando la petición del colaborador en el artículo 136 del REGLAMENTO DE LA LEY DE SERVICIO CIVIL: LICENCIAS NO REMUNERADAS, numeral 6: Otras circunstancias calificadas en las que prevalezca el interés personal del servidor y no el de la Administración Pública, siempre que no se ponga en precario el servicio.',
    [LeaveReasonType.IHSS]:
      'Fundamentando la petición del colaborador en el artículo 134 del REGLAMENTO DE LA LEY DE SERVICIO CIVIL: LICENCIAS REMUNERADAS, numeral 4: La enfermedad grave de cualquiera de los padres, hijos, hermanos, cónyuge o compañera o compañero de hogar del servidor, previa acreditación mediante certificación médica y evidencia de que fuere imprescindible su asistencia.',
    [LeaveReasonType.STUDY]:
      request.type === LeaveRequestType.PAID
        ? 'Fundamentando la petición del colaborador en el ARTÍCULO 132 del REGLAMENTO DE LA LEY DE SERVICIO CIVIL: También se concederá licencia remunerada cuando el servidor participe en un programa de adiestramiento relacionado con las funciones propias del cargo, de carácter temporal, a propuesta de la dependencia donde preste sus servicios y por el tiempo que estrictamente fuere necesario.'
        : 'Fundamentando la petición del colaborador en el ARTÍCULO 136 del REGLAMENTO DE LA LEY DE SERVICIO CIVIL: LICENCIAS NO REMUNERADAS, numeral 3: Participar en programas de adiestramiento planificados o programados por organismos no sujetos a la Ley y sobre materias que no tengan relación directa con las funciones propias del cargo, aun cuando fueren de interés profesional para el servidor.',
  })[request.reasonType];

const reportDate = () =>
  new Intl.DateTimeFormat('es-HN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
    .format(new Date())
    .toUpperCase();
const periodDate = (value: string) => {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  const words = [
    '',
    'primero',
    'dos',
    'tres',
    'cuatro',
    'cinco',
    'seis',
    'siete',
    'ocho',
    'nueve',
    'diez',
    'once',
    'doce',
    'trece',
    'catorce',
    'quince',
    'dieciséis',
    'diecisiete',
    'dieciocho',
    'diecinueve',
    'veinte',
    'veintiuno',
    'veintidós',
    'veintitrés',
    'veinticuatro',
    'veinticinco',
    'veintiséis',
    'veintisiete',
    'veintiocho',
    'veintinueve',
    'treinta',
    'treinta y uno',
  ];
  const weekday = new Intl.DateTimeFormat('es-HN', { weekday: 'long' }).format(
    date,
  );
  const monthName = new Intl.DateTimeFormat('es-HN', { month: 'long' }).format(
    date,
  );
  return `${weekday} ${words[day]} (${String(day).padStart(2, '0')}) de ${monthName} del ${year}`;
};
const definition = (
  content: TDocumentDefinitions['content'],
): TDocumentDefinitions => ({
  pageSize: 'LETTER',
  pageMargins: [55, 60, 55, 48],
  defaultStyle: { font: 'Georgias', fontSize: 10.5, lineHeight: 1.15 },
  content,
});
const heading = (to: string, from: string, label: string) =>
  [
    {
      columns: [
        { width: 70, text: 'PARA:', bold: true },
        { text: to, bold: true },
      ],
    },
    {
      columns: [
        { width: 70, text: 'DE:', bold: true },
        { text: from, bold: true },
      ],
      margin: [0, 34, 0, 0],
    },
    {
      columns: [
        { width: 70, text: 'ASUNTO:', bold: true },
        { text: label, bold: true },
      ],
      margin: [0, 28, 0, 0],
    },
    {
      columns: [
        { width: 70, text: 'FECHA:', bold: true },
        { text: reportDate(), bold: true },
      ],
      margin: [0, 10, 0, 8],
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 500,
          y2: 0,
          lineWidth: 2,
          lineColor: '#5b9bd5',
        },
      ],
      margin: [0, 0, 0, 14],
    },
  ] as any[];

export const buildHrToDirectorLeaveReport = (
  request: LeaveRequest,
): TDocumentDefinitions => {
  const label = leaveLabel(request);
  return definition([
    {
      text: request.requestNumber,
      alignment: 'center',
      bold: true,
      margin: [0, 0, 0, 28],
    },
    ...heading(
      `${DIRECTOR}\n${DIRECTOR_TITLE}`,
      `${HR_DIRECTOR}\n${HR_TITLE}`,
      label,
    ),
    {
      text: [
        { text: 'Vista la solicitud presentada por el colaborador ' },
        { text: employeeName(request), bold: true },
        {
          text: `, quien solicita ${label.toLowerCase()} por ${request.businessDays} día(s) hábil(es), del ${request.startDate} al ${request.endDate}, por el siguiente motivo: ${request.reason}.`,
        },
      ],
      alignment: 'justify',
    },
    { text: legalBasis(request), alignment: 'justify', margin: [0, 14, 0, 0] },
    {
      text: [
        {
          text: 'La Dirección de Recursos Humanos y Capacitación, basada en el artículo precedente, opina lo siguiente: ',
        },
        {
          text: `Que se proceda a otorgar ${label.toLowerCase()} al colaborador ${employeeName(request)}, por el período solicitado.`,
          bold: true,
        },
      ],
      alignment: 'justify',
      margin: [0, 14, 0, 0],
    },
    {
      image: join(__dirname, '../assets/hr-signature.png'),
      width: 230,
      alignment: 'center',
      margin: [0, 22, 0, 0],
    },
    {
      text: `${HR_DIRECTOR}\n${HR_TITLE}`,
      bold: true,
      alignment: 'center',
      fontSize: 9,
      margin: [0, -10, 0, 0],
    },
    { text: 'Cc: Archivo', fontSize: 9, margin: [0, 18, 0, 0] },
  ]);
};

export const buildFinalLeaveDecisionReport = (
  request: LeaveRequest,
): TDocumentDefinitions => {
  const label = leaveLabel(request);
  const records = request.employee?.jobRecords || [];
  const job =
    records.find((item) => item.isCurrent && item.status === 'ACTIVE') ||
    records[0];
  const position =
    job?.position?.name?.toUpperCase() || 'COLABORADOR DEL SENASA';
  const modality = job?.modality?.name || 'la modalidad registrada';
  return definition([
    {
      text: request.requestNumber,
      alignment: 'center',
      bold: true,
      margin: [0, 0, 0, 28],
    },
    ...heading(
      `${employeeName(request)}\n${position}`,
      `${DIRECTOR}\n${DIRECTOR_TITLE}`,
      label,
    ),
    {
      text: [
        { text: 'Vista la nota presentada por el colaborador ' },
        { text: employeeName(request), bold: true },
        {
          text: `, quien labora por la modalidad de ${modality}, en donde solicita ${label.toLowerCase()} del día `,
        },
        { text: periodDate(request.startDate), bold: true, italics: true },
        { text: ' al ' },
        { text: periodDate(request.endDate), bold: true, italics: true },
        {
          text: `, por ${request.reason}. Adjunta documentación correspondiente.`,
        },
      ],
      alignment: 'justify',
    },
    { text: legalBasis(request), alignment: 'justify', margin: [0, 14, 0, 0] },
    {
      text: [
        {
          text: 'En vista de contar con un dictamen favorable de la Jefatura de Personal, basada en el artículo precedente, esta Dirección General establece: ',
        },
        {
          text: `Que se proceda a otorgar ${label.toLowerCase()} al colaborador ${employeeName(request)}, por el período solicitado.`,
          bold: true,
        },
      ],
      alignment: 'justify',
      margin: [0, 14, 0, 0],
    },
    {
      image: join(__dirname, '../assets/director-general-signature.jpg'),
      width: 320,
      alignment: 'center',
      margin: [0, 24, 0, 0],
    },
    { text: 'Cc: Archivo', fontSize: 9, margin: [0, 16, 0, 0] },
  ]);
};

export const buildLeaveRequestReport = (
  request: LeaveRequest,
  destination: LeavePdfDestination,
): TDocumentDefinitions =>
  destination === 'FINAL'
    ? buildFinalLeaveDecisionReport(request)
    : buildHrToDirectorLeaveReport(request);
