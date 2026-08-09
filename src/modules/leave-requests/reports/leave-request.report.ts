import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { LeaveRequest } from '../entities/leave-request.entity';
import { LeaveRequestType } from '../enums/leave-request.enums';

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
    ? 'JEFE DEL DEPARTAMENTO DE RECURSOS HUMANOS'
    : 'DIRECTOR GENERAL DEL SENASA';
  const origin = destination === 'HR'
    ? employeeName(request)
    : 'DEPARTAMENTO DE RECURSOS HUMANOS';

  return {
    pageSize: 'LETTER',
    pageMargins: [70, 70, 70, 70],
    defaultStyle: { font: 'Georgias', fontSize: 11, lineHeight: 1.5 },
    content: [
      { text: request.requestNumber, alignment: 'right', bold: true },
      { text: 'SOLICITUD DE LICENCIA', alignment: 'center', bold: true, fontSize: 15, margin: [0, 24, 0, 24] },
      { text: `PARA: ${destinationName}`, bold: true, margin: [0, 0, 0, 8] },
      { text: `DE: ${origin}`, bold: true, margin: [0, 0, 0, 20] },
      {
        text: [
          'Por medio de la presente se solicita licencia ',
          { text: request.type === LeaveRequestType.PAID ? 'REMUNERADA' : 'NO REMUNERADA', bold: true },
          ` para ${employeeName(request)}, adscrito(a) a ${request.area?.name || 'su unidad organizacional'}, desde el ${request.startDate} hasta el ${request.endDate}, equivalente a ${request.businessDays} día(s) laboral(es).`,
        ],
        alignment: 'justify',
      },
      { text: `Motivo: ${request.reason}`, alignment: 'justify', margin: [0, 18, 0, 40] },
      {
        columns: [
          { text: '______________________________\nFirma del solicitante', alignment: 'center' },
          { text: '______________________________\nRecibido', alignment: 'center' },
        ],
      },
      { text: `Documento generado por SIGERH · ${request.requestNumber}`, fontSize: 8, color: '#64748b', alignment: 'center', margin: [0, 50, 0, 0] },
    ],
  };
};
