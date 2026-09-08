import { join } from 'path';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { VacationRequest } from '../entities/vacation-request.entity';

const fullName = (employee: any) =>
  [employee?.firstName, employee?.middleName, employee?.lastName, employee?.secondLastName]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const source = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const date = new Date(source);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

export const buildVacationRequestReport = (request: VacationRequest): TDocumentDefinitions => {
  const year = new Date(request.created_at || new Date()).getFullYear();
  const reference = `VAC-${year}-${request.id.slice(0, 8).toUpperCase()}`;
  const observations = [
    { label: 'Observaciones del colaborador', value: request.employee_comment },
    { label: 'Observaciones de jefatura', value: request.boss_observation },
    { label: 'Observaciones del enlace de RR. HH.', value: request.liaison_observation },
    { label: 'Observaciones de RR. HH.', value: request.hr_observation },
  ].filter((item) => item.value?.trim());

  const content: any[] = [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'SERVICIO NACIONAL DE SANIDAD E', bold: true, fontSize: 9 },
              { text: 'INOCUIDAD AGROALIMENTARIA', bold: true, fontSize: 9 },
              { text: 'SAG–SENASA', fontSize: 8, color: '#526174' },
            ],
          },
          {
            width: 250,
            stack: [
              { text: 'SOLICITUD DE VACACIONES', alignment: 'right', bold: true, fontSize: 16, color: '#063b45' },
              { text: reference, alignment: 'right', bold: true, margin: [0, 5, 0, 0] },
            ],
          },
        ],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 516, y2: 0, lineWidth: 2, lineColor: '#00a878' }], margin: [0, 14, 0, 20] },
      {
        table: {
          widths: [105, '*'],
          body: [
            [{ text: 'COLABORADOR', bold: true, color: '#526174' }, { text: fullName(request.employee), bold: true }],
            [{ text: 'IDENTIDAD', bold: true, color: '#526174' }, request.employee?.dni || '—'],
            [{ text: 'UNIDAD', bold: true, color: '#526174' }, request.area?.name || 'Sin unidad asignada'],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex % 2 === 0 ? '#f4f7f9' : null,
          hLineColor: () => '#dbe4ea',
          vLineColor: () => '#dbe4ea',
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },
      {
        columns: [
          { stack: [{ text: 'DESDE', bold: true, color: '#64748b', fontSize: 8 }, { text: formatDate(request.start_date), bold: true, margin: [0, 4, 0, 0] }] },
          { stack: [{ text: 'HASTA', bold: true, color: '#64748b', fontSize: 8 }, { text: formatDate(request.end_date), bold: true, margin: [0, 4, 0, 0] }] },
          { stack: [{ text: 'DÍAS SOLICITADOS', bold: true, color: '#64748b', fontSize: 8 }, { text: `${Number(request.requested_days)} día(s)`, bold: true, margin: [0, 4, 0, 0] }] },
          { stack: [{ text: 'DÍAS APROBADOS', bold: true, color: '#64748b', fontSize: 8 }, { text: `${Number(request.approved_days || 0)} día(s)`, bold: true, margin: [0, 4, 0, 0] }] },
        ],
        columnGap: 12,
        margin: [0, 20, 0, 18],
      },
      ...observations.map((item) => ({
        stack: [
          { text: item.label.toUpperCase(), bold: true, color: '#64748b', fontSize: 8 },
          { text: item.value!, alignment: 'justify', margin: [0, 5, 0, 0] },
        ],
        margin: [0, 0, 0, 14] as [number, number, number, number],
      })),
      {
        text: request.hr_status === 'APPROVED'
          ? 'AUTORIZADO POR RECURSOS HUMANOS'
          : 'VISTA PREVIA · PENDIENTE DE AUTORIZACIÓN DE RECURSOS HUMANOS',
        alignment: 'center',
        bold: true,
        color: request.hr_status === 'APPROVED' ? '#00875f' : '#b7791f',
        margin: [0, 14, 0, 0],
      },
      { image: join(__dirname, '../../leave-requests/assets/hr-signature.png'), width: 175, alignment: 'center', margin: [0, 18, 0, 0] },
      { text: 'ING. KEVIN ERNESTO MENDOZA LIRA', bold: true, alignment: 'center', fontSize: 8.5, margin: [0, -8, 0, 0] },
      { text: 'DIRECTOR DE RECURSOS HUMANOS Y CAPACITACIÓN DEL SENASA', alignment: 'center', fontSize: 7.5, color: '#526174' },
      { text: `Documento generado electrónicamente · ${reference}`, alignment: 'center', fontSize: 7, color: '#94a3b8', margin: [0, 18, 0, 0] },
    ];

  return {
    pageSize: 'LETTER',
    pageMargins: [48, 42, 48, 42],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#172033' },
    content,
  };
};
