import { Injectable } from '@nestjs/common';
import { PrinterService } from '../../../common/printer/printer.service';
import {
  ATTENDANCE_CODE_CATALOG,
  AttendanceDayResult,
  MonthlyAttendanceDay,
  MonthlyAttendanceReport,
} from '../interfaces/monthly-attendance.interface';

type ReportColumn =
  | { kind: 'day'; day: MonthlyAttendanceDay }
  | { kind: 'separator' };

@Injectable()
export class MonthlyAttendancePdfReport {
  constructor(private readonly printer: PrinterService) {}

  generate(report: MonthlyAttendanceReport) {
    const workdays = report.days.filter(
      (day) => day.weekday !== 'Sábado' && day.weekday !== 'Domingo',
    );
    const reportColumns = this.buildReportColumns(workdays);
    const fixedColumnCount = 4;
    const separatorIndexes = new Set<number>();
    reportColumns.forEach((column, index) => {
      if (column.kind === 'separator') separatorIndexes.add(fixedColumnCount + index);
    });

    const firstHeader = [
      { text: 'No.', rowSpan: 2, alignment: 'center' },
      { text: 'Código', rowSpan: 2, alignment: 'center' },
      { text: 'Empleado', rowSpan: 2 },
      { text: 'Unidad organizacional', rowSpan: 2 },
      ...reportColumns.map((column) =>
        column.kind === 'day'
          ? { text: String(column.day.number), alignment: 'center' }
          : { text: '', border: [true, false, true, false] },
      ),
    ];
    const secondHeader = [
      '',
      '',
      '',
      '',
      ...reportColumns.map((column) =>
        column.kind === 'day'
          ? { text: column.day.weekdayShort, alignment: 'center' }
          : { text: '', border: [true, false, true, true] },
      ),
    ];
    const rows = report.employees.map((employee, index) => [
      { text: String(index + 1), alignment: 'center' },
      { text: employee.biometricId || '-', alignment: 'center' },
      { text: employee.name },
      { text: employee.organizationalUnit },
      ...reportColumns.map((column) =>
        column.kind === 'day'
          ? {
              text: this.displayValue(employee.days[column.day.number]),
              alignment: 'center',
              bold: true,
            }
          : { text: '', border: [true, false, true, false] },
      ),
    ]);
    const legendRows = this.buildLegendRows();

    return this.printer.createPdf({
      pageSize: 'A3',
      pageOrientation: 'landscape',
      pageMargins: [36, 32, 36, 34],
      defaultStyle: { font: 'Roboto', fontSize: 6.2, color: '#172033' },
      footer: (currentPage: number, pageCount: number) => ({
        text: `Página ${currentPage} de ${pageCount}`,
        alignment: 'right',
        margin: [0, 8, 36, 0],
        color: '#5f6f82',
        fontSize: 6,
      }),
      content: [
        {
          text: 'SERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA',
          bold: true,
          alignment: 'center',
          fontSize: 10,
        },
        { text: 'SENASA', bold: true, alignment: 'center', fontSize: 9 },
        {
          text: 'REPORTE MENSUAL DE ASISTENCIAS DEL PERSONAL',
          bold: true,
          alignment: 'center',
          fontSize: 11,
          margin: [0, 5, 0, 7],
        },
        {
          columns: [
            { text: `REGIONAL: ${report.regional.name.toUpperCase()}`, bold: true },
            { text: `MES: ${report.period.monthName.toUpperCase()}`, bold: true, alignment: 'center' },
            { text: `AÑO: ${report.period.year}`, bold: true, alignment: 'right' },
          ],
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 2,
            dontBreakRows: true,
            keepWithHeaderRows: 2,
            widths: [18, 32, 155, 135, ...reportColumns.map((column) => (column.kind === 'day' ? 23 : 3))],
            body: [firstHeader, secondHeader, ...rows],
          },
          layout: {
            hLineWidth: (index: number) => (index <= 2 ? 0.8 : 0.35),
            vLineWidth: (index: number, node: { table: { widths: unknown[] } }) => {
              if (index === 0 || index === node.table.widths.length) return 0.8;
              if (separatorIndexes.has(index) || separatorIndexes.has(index - 1)) return 1;
              return 0.3;
            },
            hLineColor: () => '#8795a6',
            vLineColor: (index: number) =>
              separatorIndexes.has(index) || separatorIndexes.has(index - 1)
                ? '#34465a'
                : '#aab5c2',
            fillColor: (rowIndex: number, _node: unknown, columnIndex: number) => {
              if (separatorIndexes.has(columnIndex)) return '#ffffff';
              if (rowIndex < 2) return '#e7edf4';
              return rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
            },
            paddingLeft: () => 3,
            paddingRight: () => 3,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        },
        { text: 'LEYENDA INSTITUCIONAL', bold: true, fontSize: 7.5, margin: [0, 10, 0, 4] },
        {
          table: { widths: ['*', '*', '*'], body: legendRows },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 8,
            paddingTop: () => 1,
            paddingBottom: () => 1,
          },
          fontSize: 5.8,
        },
        {
          text: '!  SIN ENTRADA NI SALIDA     \\  SOLO MARCACIÓN DE SALIDA     /  SOLO MARCACIÓN DE ENTRADA',
          bold: true,
          fontSize: 6,
          margin: [0, 5, 0, 0],
        },
      ],
      styles: {},
    });
  }

  private buildReportColumns(days: MonthlyAttendanceDay[]): ReportColumn[] {
    const columns: ReportColumn[] = [];
    days.forEach((day, index) => {
      columns.push({ kind: 'day', day });
      if (day.weekday === 'Viernes' && index < days.length - 1) {
        columns.push({ kind: 'separator' });
      }
    });
    return columns;
  }

  private displayValue(day?: AttendanceDayResult) {
    if (!day) return '';
    if (day.code) return day.code;
    if (day.status === 'MISSING_ENTRY') return '\\';
    if (day.status === 'MISSING_EXIT') return '/';
    if (day.status === 'MISSING_BOTH' || day.status === 'NO_DATA') return '!';
    return '';
  }

  private buildLegendRows() {
    const items = ATTENDANCE_CODE_CATALOG.map(([code, description]) => ({
      text: [{ text: `${code}  `, bold: true }, { text: description }],
    }));
    const rows: Array<Array<{ text: unknown }>> = [];
    for (let index = 0; index < items.length; index += 3) {
      rows.push([items[index], items[index + 1] || { text: '' }, items[index + 2] || { text: '' }]);
    }
    return rows;
  }
}
