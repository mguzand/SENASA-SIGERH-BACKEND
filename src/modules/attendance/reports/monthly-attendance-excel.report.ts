import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { MonthlyAttendanceReport } from '../interfaces/monthly-attendance.interface';

@Injectable()
export class MonthlyAttendanceExcelReport {
  async generate(report: MonthlyAttendanceReport): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SIGERH';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Asistencia', {
      views: [{ state: 'frozen', xSplit: 4, ySplit: 5 }],
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
    });

    sheet.mergeCells('A1:L1');
    sheet.getCell('A1').value = 'REPORTE MENSUAL DE ASISTENCIA DEL PERSONAL';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2747' } };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 28;

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = `Regional: ${report.regional.name}`;
    sheet.mergeCells('G2:L2');
    sheet.getCell('G2').value = `Período: ${report.period.monthName} ${report.period.year}`;
    sheet.getRow(2).font = { bold: true, color: { argb: 'FF526983' } };

    sheet.columns = [
      { key: 'number', width: 7 },
      { key: 'biometricId', width: 12 },
      { key: 'employee', width: 34 },
      { key: 'unit', width: 34 },
      { key: 'date', width: 13 },
      { key: 'day', width: 13 },
      { key: 'code', width: 14 },
      { key: 'type', width: 30 },
      { key: 'entry', width: 14 },
      { key: 'exit', width: 14 },
      { key: 'scheduledEntry', width: 17 },
      { key: 'scheduledExit', width: 17 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.values = [
      'No.', 'Código', 'Empleado', 'Unidad organizacional', 'Fecha', 'Día',
      'Tipo / código', 'Descripción', 'Hora entrada', 'Hora salida',
      'Horario entrada', 'Horario salida',
    ];
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1769AA' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD8E2EC' } } };
    });

    let detailNumber = 1;
    for (const employee of report.employees) {
      for (const day of report.days) {
        const result = employee.days[day.number];
        const row = sheet.addRow({
          number: detailNumber++,
          biometricId: employee.biometricId || '—',
          employee: employee.name,
          unit: employee.organizationalUnit,
          date: new Date(`${day.date}T00:00:00`),
          day: day.weekday,
          code: result.code || this.fallbackCode(result.status),
          type: result.description,
          entry: this.timeValue(result.entry),
          exit: this.timeValue(result.exit),
          scheduledEntry: this.timeValue(result.scheduledEntry),
          scheduledExit: this.timeValue(result.scheduledExit),
        });
        row.getCell(5).numFmt = 'dd/mm/yyyy';
        [9, 10, 11, 12].forEach((index) => (row.getCell(index).numFmt = 'h:mm AM/PM'));
        row.eachCell((cell) => {
          cell.alignment = { vertical: 'middle', wrapText: false };
          cell.border = { bottom: { style: 'hair', color: { argb: 'FFDCE5EF' } } };
        });
        if (row.number % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } };
          });
        }
      }
    }

    sheet.autoFilter = { from: 'A4', to: `L${Math.max(sheet.rowCount, 4)}` };
    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
  }

  private timeValue(value?: string | null): Date | null {
    if (!value) return null;
    const [hours, minutes, seconds = 0] = value.split(':').map(Number);
    return new Date(1899, 11, 30, hours, minutes, seconds);
  }

  private fallbackCode(status: string): string {
    if (status === 'MISSING_ENTRY') return '\\';
    if (status === 'MISSING_EXIT') return '/';
    if (status === 'MISSING_BOTH' || status === 'NO_DATA') return '!';
    return '—';
  }
}
