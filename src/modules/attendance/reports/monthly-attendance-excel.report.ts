import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';

import {
  AttendanceDayResult,
  MonthlyAttendanceReport,
} from '../interfaces/monthly-attendance.interface';

@Injectable()
export class MonthlyAttendanceExcelReport {
  async generate(report: MonthlyAttendanceReport): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'SIGERH';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Asistencia', {
      views: [
        {
          state: 'frozen',
          xSplit: 4,
          ySplit: 4,
        },
      ],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      },
    });

    /*
     * ============================================================
     * CONFIGURACIÓN GENERAL
     * ============================================================
     */

    const firstDayColumn = 5; // E
    const lastDayColumn = firstDayColumn + report.days.length - 1;

    /*
     * ============================================================
     * ANCHOS DE COLUMNAS
     * ============================================================
     */

    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 11;
    sheet.getColumn(3).width = 35;
    sheet.getColumn(4).width = 35;

    for (
      let columnIndex = firstDayColumn;
      columnIndex <= lastDayColumn;
      columnIndex++
    ) {
      sheet.getColumn(columnIndex).width = 5;
    }

    /*
     * ============================================================
     * TÍTULO
     * ============================================================
     */

    sheet.mergeCells(1, 1, 1, lastDayColumn);

    const titleCell = sheet.getCell(1, 1);

    titleCell.value = 'REPORTE MENSUAL DE ASISTENCIA DEL PERSONAL';

    titleCell.font = {
      bold: true,
      size: 16,
      color: {
        argb: 'FFFFFFFF',
      },
    };

    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: 'FF0F2747',
      },
    };

    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };

    sheet.getRow(1).height = 28;

    /*
     * ============================================================
     * INFORMACIÓN DEL REPORTE
     * ============================================================
     */

    const middleColumn = Math.max(4, Math.floor(lastDayColumn / 2));

    sheet.mergeCells(2, 1, 2, middleColumn);

    sheet.getCell(2, 1).value = `Regional: ${report.regional.name}`;

    sheet.mergeCells(2, middleColumn + 1, 2, lastDayColumn);

    sheet.getCell(2, middleColumn + 1).value =
      `Período: ${report.period.monthName} ${report.period.year}`;

    sheet.getRow(2).font = {
      bold: true,
      color: {
        argb: 'FF526983',
      },
    };

    sheet.getRow(2).height = 20;

    /*
     * ============================================================
     * ENCABEZADOS
     * ============================================================
     */

    const headerRow = sheet.getRow(4);

    headerRow.getCell(1).value = 'No.';
    headerRow.getCell(2).value = 'Código';
    headerRow.getCell(3).value = 'Empleado';
    headerRow.getCell(4).value = 'Unidad organizacional';

    report.days.forEach((day, index) => {
      const column = firstDayColumn + index;

      headerRow.getCell(column).value = `${day.number}\n${day.weekdayShort}`;
    });

    headerRow.height = 34;

    for (let column = 1; column <= lastDayColumn; column++) {
      const cell = headerRow.getCell(column);

      cell.font = {
        bold: true,
        color: {
          argb: 'FFFFFFFF',
        },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: 'FF1769AA',
        },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };

      cell.border = this.fullBorder();
    }

    /*
     * ============================================================
     * EMPLEADOS
     * ============================================================
     */

    report.employees.forEach((employee, employeeIndex) => {
      const rowNumber = 5 + employeeIndex;

      const row = sheet.getRow(rowNumber);

      row.getCell(1).value = employeeIndex + 1;
      row.getCell(2).value = employee.biometricId || '—';
      row.getCell(3).value = employee.name;
      row.getCell(4).value = employee.organizationalUnit;

      row.height = 22;

      /*
       * ----------------------------------------------------------
       * DATOS GENERALES DEL EMPLEADO
       * ----------------------------------------------------------
       */

      for (let column = 1; column <= 4; column++) {
        const cell = row.getCell(column);

        cell.alignment = {
          vertical: 'middle',
          horizontal: column <= 2 ? 'center' : 'left',
        };

        cell.border = this.fullBorder();
      }

      /*
       * ----------------------------------------------------------
       * DÍAS DEL MES
       * ----------------------------------------------------------
       */

      report.days.forEach((day, dayIndex) => {
        const column = firstDayColumn + dayIndex;

        const result = employee.days[day.number];

        const cell = row.getCell(column);

        /*
         * Valor que aparecerá visualmente en la celda.
         */
        cell.value = this.displayValue(result);

        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };

        cell.font = {
          bold: true,
          size: 9,
        };

        cell.border = this.fullBorder();

        /*
         * --------------------------------------------------------
         * FIN DE SEMANA
         * --------------------------------------------------------
         */

        if (day.weekday === 'Sábado' || day.weekday === 'Domingo') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: {
              argb: 'FFF0F2F5',
            },
          };
        }

        /*
         * --------------------------------------------------------
         * COMENTARIO / NOTA DE EXCEL
         * --------------------------------------------------------
         *
         * X = Marcación normal
         *
         * A las marcaciones normales NO les ponemos comentario.
         *
         * Todo lo demás:
         *
         * LT
         * /
         * \
         * !
         * PO
         * PP
         * CM
         * MP
         * SSP
         * OP
         * V
         * ACV
         * L
         * LNR
         * etc.
         *
         * tendrá comentario.
         */

        if (this.shouldAddNote(result)) {
          const note = this.buildAttendanceNote(result);

          if (note) {
            cell.note = {
              texts: [
                {
                  font: {
                    bold: true,
                    size: 10,
                  },
                  text: 'DETALLE\n',
                },
                {
                  font: {
                    size: 10,
                  },
                  text: note,
                },
              ],
              margins: {
                insetmode: 'custom',
                inset: [0.13, 0.13, 0.13, 0.13],
              },
              editAs: 'twoCells',
            };
          }
        }
      });
    });

    /*
     * ============================================================
     * CONFIGURACIÓN DE IMPRESIÓN
     * ============================================================
     */

    sheet.pageSetup.printTitlesRow = '1:4';

    sheet.pageSetup.printArea = `A1:${this.columnLetter(lastDayColumn)}${sheet.rowCount}`;

    sheet.properties.defaultRowHeight = 18;

    /*
     * ============================================================
     * GENERAR ARCHIVO
     * ============================================================
     */

    const output = await workbook.xlsx.writeBuffer();

    return Buffer.from(output);
  }

  /*
   * ==============================================================
   * DETERMINAR SI SE AGREGA COMENTARIO
   * ==============================================================
   */

  private shouldAddNote(result?: AttendanceDayResult): boolean {
    if (!result) {
      return false;
    }

    /*
     * Marcación completamente normal.
     *
     * No necesitamos llenar el Excel de comentarios
     * innecesarios.
     */
    if (result.code === 'X' && result.status === 'PRESENT') {
      return false;
    }

    /*
     * Fin de semana sin ninguna novedad.
     */
    if (result.status === 'NON_WORKING_DAY') {
      return false;
    }

    return true;
  }

  /*
   * ==============================================================
   * CONSTRUIR COMENTARIO
   * ==============================================================
   */

  private buildAttendanceNote(result: AttendanceDayResult): string {
    const lines: string[] = [];

    /*
     * Descripción principal.
     *
     * Ejemplo:
     *
     * Llegada tardía
     * Permiso Oficial
     * Reunión oficinas centrales
     * Vacación aprobada
     */
    if (result.description) {
      lines.push(result.description.trim());
    }

    /*
     * Separador.
     */
    if (
      result.entry ||
      result.exit ||
      result.scheduledEntry ||
      result.scheduledExit
    ) {
      lines.push('');
    }

    /*
     * MARCACIONES REALES
     */

    if (result.entry) {
      lines.push(`Hora de entrada: ${this.formatTime(result.entry)}`);
    }

    if (result.exit) {
      lines.push(`Hora de salida: ${this.formatTime(result.exit)}`);
    }

    /*
     * Si falta entrada, dejarlo explícito.
     */
    if (result.status === 'MISSING_ENTRY') {
      lines.push('Hora de entrada: SIN MARCACIÓN');
    }

    /*
     * Si falta salida, dejarlo explícito.
     */
    if (result.status === 'MISSING_EXIT') {
      lines.push('Hora de salida: SIN MARCACIÓN');
    }

    /*
     * Si faltan ambas.
     */
    if (result.status === 'MISSING_BOTH' || result.status === 'NO_DATA') {
      if (!result.entry && !result.exit) {
        lines.push('Entrada y salida: SIN MARCACIÓN');
      }
    }

    /*
     * HORARIO ASIGNADO
     */

    if (result.scheduledEntry || result.scheduledExit) {
      lines.push('');

      lines.push(
        `Horario asignado: ${this.formatTime(
          result.scheduledEntry,
        )} - ${this.formatTime(result.scheduledExit)}`,
      );
    }

    return lines.join('\n');
  }

  /*
   * ==============================================================
   * VALOR VISUAL DE LA CELDA
   * ==============================================================
   */

  private displayValue(result?: AttendanceDayResult): string {
    if (!result) {
      return '';
    }

    /*
     * Si ya existe código administrativo,
     * mostrarlo directamente.
     */
    if (result.code) {
      return result.code;
    }

    /*
     * Sin entrada.
     *
     * El reporte institucional utiliza:
     *
     * \ = solo marcación de salida
     */
    if (result.status === 'MISSING_ENTRY') {
      return '\\';
    }

    /*
     * Sin salida.
     *
     * / = solo marcación de entrada
     */
    if (result.status === 'MISSING_EXIT') {
      return '/';
    }

    /*
     * Ninguna marcación.
     */
    if (result.status === 'MISSING_BOTH' || result.status === 'NO_DATA') {
      return '!';
    }

    return '';
  }

  /*
   * ==============================================================
   * FORMATO DE HORA
   * ==============================================================
   *
   * Convierte:
   *
   * 08:30:00 -> 8:30 a. m.
   * 13:45:00 -> 1:45 p. m.
   */

  private formatTime(value?: string | null): string {
    if (!value) {
      return '—';
    }

    const parts = value.split(':');

    if (parts.length < 2) {
      return value;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return value;
    }

    const suffix = hours >= 12 ? 'p. m.' : 'a. m.';

    const hour12 = hours % 12 || 12;

    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }

  /*
   * ==============================================================
   * BORDES
   * ==============================================================
   */

  private fullBorder(): Partial<ExcelJS.Borders> {
    return {
      top: {
        style: 'thin',
        color: {
          argb: 'FFD8E2EC',
        },
      },
      left: {
        style: 'thin',
        color: {
          argb: 'FFD8E2EC',
        },
      },
      bottom: {
        style: 'thin',
        color: {
          argb: 'FFD8E2EC',
        },
      },
      right: {
        style: 'thin',
        color: {
          argb: 'FFD8E2EC',
        },
      },
    };
  }

  /*
   * ==============================================================
   * NÚMERO DE COLUMNA -> LETRA DE EXCEL
   * ==============================================================
   *
   * 1  -> A
   * 26 -> Z
   * 27 -> AA
   */

  private columnLetter(columnNumber: number): string {
    let result = '';
    let value = columnNumber;

    while (value > 0) {
      const remainder = (value - 1) % 26;

      result = String.fromCharCode(65 + remainder) + result;

      value = Math.floor((value - 1) / 26);
    }

    return result;
  }
}
