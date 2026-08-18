import { Injectable } from '@nestjs/common';
import { PrinterService } from '../../../common/printer/printer.service';
import { ATTENDANCE_CODE_CATALOG, MonthlyAttendanceReport } from '../interfaces/monthly-attendance.interface';

@Injectable()
export class MonthlyAttendancePdfReport {
  constructor(private readonly printer: PrinterService) {}

  generate(report: MonthlyAttendanceReport) {
    const fixedWidths = [16, 25, 95, 55, 85];
    const dayWidth = 15;
    const firstHeader = [
      { text: 'No.', rowSpan: 2 }, { text: 'Código', rowSpan: 2 }, { text: 'Empleado', rowSpan: 2 },
      { text: 'Regional', rowSpan: 2 }, { text: 'Unidad organizacional', rowSpan: 2 },
      ...report.days.map((day) => ({ text: String(day.number), alignment: 'center' })),
    ];
    const secondHeader = ['', '', '', '', '', ...report.days.map((day) => ({ text: day.weekdayShort, alignment: 'center' }))];
    const rows = report.employees.map((employee, index) => [
      String(index + 1), employee.biometricId || '—', employee.name, employee.regional, employee.organizationalUnit,
      ...report.days.map((day) => ({ text: employee.days[day.number]?.code || '', alignment: 'center' })),
    ]);
    const legend = ATTENDANCE_CODE_CATALOG.map(([code, description]) => `${code}  ${description}`).join('    ');
    return this.printer.createPdf({
      pageSize: 'A3', pageOrientation: 'landscape', pageMargins: [20, 24, 20, 24],
      defaultStyle: { font: 'Roboto', fontSize: 6 },
      content: [
        { text: 'SERVICIO NACIONAL DE SANIDAD E INOCUIDAD AGROALIMENTARIA\nSENASA', bold: true, alignment: 'center', fontSize: 10 },
        { text: 'REPORTE MENSUAL DE ASISTENCIAS DEL PERSONAL', bold: true, alignment: 'center', fontSize: 11, margin: [0, 5, 0, 5] },
        { text: `REGIONAL: ${report.regional.name.toUpperCase()}    MES: ${report.period.monthName.toUpperCase()}    AÑO: ${report.period.year}`, bold: true, margin: [0, 0, 0, 6] },
        { table: { headerRows: 2, widths: [...fixedWidths, ...report.days.map(() => dayWidth)], body: [firstHeader, secondHeader, ...rows] }, layout: 'lightHorizontalLines' },
        { text: 'LEYENDA', bold: true, fontSize: 8, margin: [0, 8, 0, 3] },
        { text: legend, fontSize: 6, lineHeight: 1.3 },
      ],
      styles: {},
    });
  }
}
