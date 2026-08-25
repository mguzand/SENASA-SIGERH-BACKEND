import { join } from 'path';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { EmployeeExitPermit } from '../entities/employee-exit-permit.entity';

const fullName = (employee: any) =>
  [employee?.firstName, employee?.middleName, employee?.lastName, employee?.secondLastName]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return '—';
  const source = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T12:00:00`
    : value;
  const date = new Date(source);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat('es-HN', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
};

const formatTime = (value: string | null | undefined) => value ? value.slice(0, 5) : 'Sin retorno';

export const buildEmployeeExitPermitReport = (
  permit: EmployeeExitPermit,
): TDocumentDefinitions => {
  const reference = `PS-${new Date(permit.created_at || new Date()).getFullYear()}-${permit.id.slice(0, 8).toUpperCase()}`;
  const observations = [
    { label: 'Motivo y observaciones del empleado', value: permit.description },
    { label: 'Observaciones de jefatura', value: permit.boss_observation },
    { label: 'Observaciones de RR. HH.', value: permit.hr_observation },
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
            width: 220,
            stack: [
              { text: 'PASE DE SALIDA', alignment: 'right', bold: true, fontSize: 17, color: '#063b45' },
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
            [{ text: 'COLABORADOR', bold: true, color: '#526174' }, { text: fullName(permit.employee), bold: true }],
            [{ text: 'IDENTIDAD', bold: true, color: '#526174' }, permit.employee?.dni || '—'],
            [{ text: 'UNIDAD', bold: true, color: '#526174' }, permit.area?.name || 'Sin unidad asignada'],
            [{ text: 'TIPO DE PASE', bold: true, color: '#526174' }, permit.permit_type || 'Personal'],
          ],
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex % 2 === 0 ? '#f4f7f9' : null,
          hLineColor: () => '#dbe4ea', vLineColor: () => '#dbe4ea',
          paddingLeft: () => 9, paddingRight: () => 9, paddingTop: () => 8, paddingBottom: () => 8,
        },
      },
      {
        columns: [
          { stack: [{ text: 'FECHA DE SALIDA', bold: true, color: '#64748b', fontSize: 8 }, { text: formatDate(permit.exit_date), bold: true, margin: [0, 4, 0, 0] }] },
          { stack: [{ text: 'FECHA DE FINALIZACIÓN', bold: true, color: '#64748b', fontSize: 8 }, { text: formatDate(permit.end_date || permit.exit_date), bold: true, margin: [0, 4, 0, 0] }] },
          { stack: [{ text: 'HORARIO', bold: true, color: '#64748b', fontSize: 8 }, { text: `${formatTime(permit.exit_time)} – ${permit.without_return ? 'Sin retorno' : formatTime(permit.return_time)}`, bold: true, margin: [0, 4, 0, 0] }] },
        ],
        columnGap: 14,
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
        text: permit.hr_status === 'approved'
          ? 'AUTORIZADO POR RECURSOS HUMANOS'
          : 'VISTA PREVIA · PENDIENTE DE AUTORIZACIÓN DE RECURSOS HUMANOS',
        alignment: 'center', bold: true,
        color: permit.hr_status === 'approved' ? '#00875f' : '#b7791f',
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
