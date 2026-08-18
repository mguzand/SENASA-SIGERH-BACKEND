import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { MonthlyAttendanceFilterDto } from './dto/monthly-attendance-filter.dto';
import { MonthlyAttendancePdfReport } from './reports/monthly-attendance.report';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly service: AttendanceService, private readonly pdfReport: MonthlyAttendancePdfReport) {}
  @Get('employees') getEmployees(@Query('regionalId') regionalId?: string) { return this.service.getEmployeeOptions(regionalId); }
  @Get('monthly-report') getMonthly(@Query() query: MonthlyAttendanceFilterDto) { return this.service.getMonthlyReport(query); }
  @Get('monthly-report/pdf') async getMonthlyPdf(@Query() query: MonthlyAttendanceFilterDto, @Res() response: Response) {
    const report = await this.service.getMonthlyReport(query);
    const pdf = this.pdfReport.generate(report);
    const regional = report.regional.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="reporte-asistencia-${regional}-${query.month}-${query.year}.pdf"`);
    pdf.pipe(response); pdf.end();
  }
}
