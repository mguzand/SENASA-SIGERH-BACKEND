import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VacationRequestStatus } from '../../common/enums/vacation.enums';
import { EmployeeExitPermit } from '../employee-exit-permits/entities/employee-exit-permit.entity';
import { Components } from '../components/entities/components.entity';
import { ExitPermitStatus } from '../employee-exit-permits/enums/exit-permit-status.enum';
import { Employee } from '../employees/entities/employee.entity';
import { GovernmentVacationDay } from '../government-vacation-day/entities/government-vacation-day.entity';
import { Holiday } from '../holiday/entities/holiday.entity';
import { LeaveRequest } from '../leave-requests/entities/leave-request.entity';
import { LeaveRequestStatus, LeaveRequestType } from '../leave-requests/enums/leave-request.enums';
import { VacationRequest } from '../vacation-request/entities/vacation-request.entity';
import { WatchesService } from '../watches/watches.service';
import { MonthlyAttendanceFilterDto } from './dto/monthly-attendance-filter.dto';
import { AttendanceDayResult, AttendanceIncident, BiometricMark, MonthlyAttendanceDay, MonthlyAttendanceReport } from './interfaces/monthly-attendance.interface';

export const BIOMETRIC_BATCH_SIZE = 10;
export const LATE_TOLERANCE_MINUTES = 0;
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAY_SHORT = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function buildMonthlyCalendar(month: number, year: number): MonthlyAttendanceDay[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(number).padStart(2, '0')}`;
    const weekdayIndex = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { number, date, weekday: WEEKDAYS[weekdayIndex], weekdayShort: WEEKDAY_SHORT[weekdayIndex] };
  });
}

function minutes(value: string): number {
  const [hours, mins] = value.split(':').map(Number);
  return hours * 60 + mins;
}

export function resolveAttendanceCode(input: {
  isWeekend: boolean; schedule: { startTime: string; endTime: string } | null;
  mark?: BiometricMark; incidents?: AttendanceIncident[];
}): AttendanceDayResult {
  const incidents = input.incidents || [];
  const priority: AttendanceIncident['kind'][] = ['VACATION', 'GOVERNMENT_VACATION', 'HOLIDAY', 'UNPAID_LEAVE', 'PAID_LEAVE', 'PERMIT'];
  const incident = priority.map((kind) => incidents.find((item) => item.kind === kind)).find(Boolean);
  if (incident) {
    const base = { entry: input.mark?.entry || null, exit: input.mark?.exit || null, source: 'ADMINISTRATIVE' as const };
    if (incident.kind === 'VACATION') return { ...base, code: 'V', status: 'VACATION', description: incident.description };
    if (incident.kind === 'HOLIDAY') return { ...base, code: 'A', status: 'HOLIDAY', description: incident.description };
    if (incident.kind === 'GOVERNMENT_VACATION') return { ...base, code: incident.affectsVacationBalance ? 'ACV' : 'A', status: 'GOVERNMENT_VACATION', description: incident.description };
    if (incident.kind === 'UNPAID_LEAVE') return { ...base, code: 'LNR', status: 'UNPAID_LEAVE', description: incident.description };
    if (incident.kind === 'PAID_LEAVE') return { ...base, code: null, status: 'PAID_LEAVE', description: 'Licencia remunerada', requiresClassification: true };
    const permit = incident.permitType?.trim().toLowerCase();
    const code = permit === 'personal' ? 'PP' : permit === 'oficial' ? 'PO' : null;
    return { ...base, code, status: 'PERMIT', description: incident.description, requiresClassification: !code };
  }
  const scheduled = { scheduledEntry: input.schedule?.startTime || null, scheduledExit: input.schedule?.endTime || null };
  if (!input.mark) return { code: null, status: input.isWeekend ? 'NON_WORKING_DAY' : 'NO_DATA', description: input.isWeekend ? 'Fin de semana sin novedad' : 'Sin información de asistencia', entry: null, exit: null, ...scheduled, source: null };
  if (!input.mark.entry) return { code: null, status: 'MISSING_ENTRY', description: 'Sin marcación de entrada', entry: null, exit: input.mark.exit, ...scheduled, source: 'BIOMETRIC' };
  if (!input.mark.exit) return { code: null, status: 'MISSING_EXIT', description: 'Sin marcación de salida', entry: input.mark.entry, exit: null, ...scheduled, source: 'BIOMETRIC' };
  if (!input.schedule) return { code: null, status: 'NO_SCHEDULE', description: 'Marcación no evaluable: empleado sin horario', entry: input.mark.entry, exit: input.mark.exit, ...scheduled, source: 'BIOMETRIC' };
  const late = minutes(input.mark.entry) > minutes(input.schedule.startTime) + LATE_TOLERANCE_MINUTES;
  return { code: late ? 'LT' : 'X', status: late ? 'LATE' : 'PRESENT', description: late ? 'Llegada tardía' : 'Marcación normal', entry: input.mark.entry, exit: input.mark.exit, ...scheduled, source: 'BIOMETRIC' };
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
  constructor(
    @InjectRepository(Employee) private readonly employees: Repository<Employee>,
    @InjectRepository(VacationRequest) private readonly vacations: Repository<VacationRequest>,
    @InjectRepository(EmployeeExitPermit) private readonly permits: Repository<EmployeeExitPermit>,
    @InjectRepository(LeaveRequest) private readonly leaves: Repository<LeaveRequest>,
    @InjectRepository(Holiday) private readonly holidays: Repository<Holiday>,
    @InjectRepository(GovernmentVacationDay) private readonly governmentDays: Repository<GovernmentVacationDay>,
    @InjectRepository(Components) private readonly components: Repository<Components>,
    private readonly configService: ConfigService,
    private readonly watchesService: WatchesService,
  ) {}

  async ensurePermissionComponent() {
    const systemId = this.configService.get<string>('DEFAULT_SYSTEM_ID', '6816a2e5-085a-4d96-8a36-a8546d886051');
    const existing = await this.components.findOne({ where: { system_id: systemId, description: 'Reporte de asistencia' } });
    if (existing) return existing;
    const last = await this.components.findOne({ where: { system_id: systemId }, order: { orden: 'DESC' } });
    return this.components.save(this.components.create({ description: 'Reporte de asistencia', system_id: systemId, orden: Number(last?.orden || 0) + 1, visible: true }));
  }

  async getEmployeeOptions(regionalId?: string) {
    const query = this.employees.createQueryBuilder('employee')
      .select(['employee.id', 'employee.firstName', 'employee.middleName', 'employee.lastName', 'employee.secondLastName', 'employee.regional_id'])
      .where('employee.status = :status', { status: 'ACTIVE' })
      .orderBy('employee.firstName', 'ASC').addOrderBy('employee.lastName', 'ASC');
    if (regionalId) query.andWhere('employee.regional_id = :regionalId', { regionalId });
    return (await query.getMany()).map((employee) => ({ id: employee.id, name: this.fullName(employee), regionalId: employee.regional_id }));
  }

  async getMonthlyReport(filter: MonthlyAttendanceFilterDto): Promise<MonthlyAttendanceReport> {
    const days = buildMonthlyCalendar(filter.month, filter.year);
    const start = days[0].date;
    const end = days[days.length - 1].date;
    const query = this.employees.createQueryBuilder('employee')
      .leftJoinAndSelect('employee.schedule', 'schedule').leftJoinAndSelect('employee.regional', 'regional')
      .leftJoinAndSelect('employee.jobRecords', 'jobRecord', 'jobRecord.isCurrent = :current', { current: true })
      .leftJoinAndSelect('jobRecord.area', 'area').where('employee.status = :status', { status: 'ACTIVE' })
      .orderBy('employee.firstName', 'ASC').addOrderBy('employee.lastName', 'ASC');
    if (filter.regionalId) query.andWhere('employee.regional_id = :regionalId', { regionalId: filter.regionalId });
    if (filter.employeeId) query.andWhere('employee.id = :employeeId', { employeeId: filter.employeeId });
    const employees = await query.getMany();
    const employeeIds = employees.map((item) => item.id);
    const incidents = await this.loadIncidents(employeeIds, start, end);
    const marks = new Map<string, Map<string, BiometricMark>>();
    const warnings: string[] = [];
    for (let offset = 0; offset < employees.length; offset += BIOMETRIC_BATCH_SIZE) {
      await Promise.all(employees.slice(offset, offset + BIOMETRIC_BATCH_SIZE).map(async (employee) => {
        if (!employee.biometric_id) { warnings.push(`${this.fullName(employee)} no tiene identificación biométrica.`); return; }
        if (!employee.schedule) { warnings.push(`${this.fullName(employee)} no tiene horario asignado.`); return; }
        try {
          const raw = await this.watchesService.getReporteMarcaciones({ userid: employee.biometric_id, mes: filter.month, anio: filter.year, horaEntrada: employee.schedule.startTime, horaSalida: employee.schedule.endTime });
          const byDate = new Map<string, BiometricMark>();
          for (const row of raw || []) {
            const date = this.normalizeWatchDate(row.Fecha);
            if (date) byDate.set(date, { entry: row.Hora_Ingreso || null, exit: row.Hora_Salida || null });
          }
          marks.set(employee.id, byDate);
        } catch (error) {
          const message = `No se pudieron consultar las marcaciones de ${this.fullName(employee)}.`;
          warnings.push(message); this.logger.error(message, error instanceof Error ? error.stack : undefined);
        }
      }));
    }
    return {
      period: { month: filter.month, year: filter.year, monthName: MONTH_NAMES[filter.month - 1] },
      regional: filter.regionalId ? { id: filter.regionalId, name: employees[0]?.regional?.name || 'Regional seleccionada' } : { id: null, name: 'Todas las regionales' },
      days,
      employees: employees.map((employee) => ({
        id: employee.id, biometricId: employee.biometric_id || null, name: this.fullName(employee),
        regional: employee.regional?.name || 'Sin regional', organizationalUnit: employee.jobRecords?.[0]?.area?.name || 'Sin unidad asignada',
        schedule: employee.schedule ? { startTime: employee.schedule.startTime, endTime: employee.schedule.endTime } : null,
        days: Object.fromEntries(days.map((day) => [day.number, resolveAttendanceCode({ isWeekend: ['Sábado', 'Domingo'].includes(day.weekday), schedule: employee.schedule ? { startTime: employee.schedule.startTime, endTime: employee.schedule.endTime } : null, mark: marks.get(employee.id)?.get(day.date), incidents: incidents.get(`${employee.id}|${day.date}`) || incidents.get(`*|${day.date}`) })])),
        observations: !employee.biometric_id ? 'Sin identificación biométrica' : !employee.schedule ? 'Sin horario asignado' : '',
      })), warnings,
    };
  }

  private async loadIncidents(employeeIds: string[], start: string, end: string) {
    const map = new Map<string, AttendanceIncident[]>();
    const add = (employeeId: string, date: string, incident: AttendanceIncident) => { const key = `${employeeId}|${date}`; map.set(key, [...(map.get(key) || []), incident]); };
    const [vacations, permits, leaves, holidays, governmentDays] = employeeIds.length ? await Promise.all([
      this.vacations.createQueryBuilder('request').leftJoinAndSelect('request.days', 'day').where('request.employee_id IN (:...ids)', { ids: employeeIds }).andWhere('request.status = :approvedStatus AND request.hr_status = :approvedHrStatus', { approvedStatus: VacationRequestStatus.APPROVED, approvedHrStatus: VacationRequestStatus.APPROVED }).andWhere('day.date BETWEEN :start AND :end', { start, end }).getMany(),
      this.permits.createQueryBuilder('permit').where('permit.employee_id IN (:...ids)', { ids: employeeIds }).andWhere('permit.status = :approvedStatus AND permit.hr_status = :approvedHrStatus', { approvedStatus: ExitPermitStatus.APPROVED, approvedHrStatus: ExitPermitStatus.APPROVED }).andWhere('permit.exit_date BETWEEN :start AND :end', { start, end }).getMany(),
      this.leaves.createQueryBuilder('leave').where('leave.employee_id IN (:...ids)', { ids: employeeIds }).andWhere('leave.status = :approvedStatus AND leave.hr_status = :approvedHrStatus', { approvedStatus: LeaveRequestStatus.APPROVED, approvedHrStatus: LeaveRequestStatus.APPROVED }).andWhere('leave.start_date <= :end AND leave.end_date >= :start', { start, end }).getMany(),
      this.holidays.createQueryBuilder('holiday').where('holiday.is_active = true').andWhere('holiday.date BETWEEN :start AND :end', { start, end }).getMany(),
      this.governmentDays.createQueryBuilder('day').where('day.isActive = true').andWhere('day.date BETWEEN :start AND :end', { start, end }).getMany(),
    ]) : [[], [], [], await this.holidays.createQueryBuilder('holiday').where('holiday.is_active = true').andWhere('holiday.date BETWEEN :start AND :end', { start, end }).getMany(), await this.governmentDays.createQueryBuilder('day').where('day.isActive = true').andWhere('day.date BETWEEN :start AND :end', { start, end }).getMany()];
    vacations.forEach((request) => request.days.forEach((day) => add(request.employee_id, day.date, { kind: 'VACATION', description: 'Vacación aprobada' })));
    permits.forEach((permit) => add(permit.employee_id, String(permit.exit_date).slice(0, 10), { kind: 'PERMIT', description: permit.description || `Permiso ${permit.permit_type}`, permitType: permit.permit_type }));
    leaves.forEach((leave) => this.dateRange(leave.startDate, leave.endDate).forEach((date) => add(leave.employeeId, date, { kind: leave.type === LeaveRequestType.UNPAID ? 'UNPAID_LEAVE' : 'PAID_LEAVE', description: leave.type === LeaveRequestType.UNPAID ? 'Licencia no remunerada' : 'Licencia remunerada' })));
    holidays.forEach((holiday) => add('*', holiday.date, { kind: 'HOLIDAY', description: holiday.name || 'Asueto / feriado' }));
    governmentDays.forEach((day) => add('*', day.date, { kind: 'GOVERNMENT_VACATION', description: day.title, affectsVacationBalance: day.affectsVacationBalance }));
    return map;
  }

  private dateRange(start: string, end: string) { const result: string[] = []; for (let date = new Date(`${start}T00:00:00Z`); date <= new Date(`${end}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1)) result.push(date.toISOString().slice(0, 10)); return result; }
  private normalizeWatchDate(value: unknown): string | null { const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/); return match ? `${match[3]}-${match[2]}-${match[1]}` : /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : null; }
  private fullName(employee: Employee) { return [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName].filter(Boolean).join(' ').toUpperCase(); }
}
