import { buildMonthlyCalendar, resolveAttendanceCode } from './attendance.service';

describe('Attendance report rules', () => {
  const schedule = { startTime: '08:00:00', endTime: '16:00:00' };
  it.each([[2, 2025, 28], [2, 2024, 29], [4, 2026, 30], [1, 2026, 31]])('builds month %i/%i with %i days', (month, year, count) => expect(buildMonthlyCalendar(month, year)).toHaveLength(count));
  it('resolves a normal mark', () => expect(resolveAttendanceCode({ isWeekend: false, schedule, mark: { entry: '07:58:00', exit: '16:04:00' } }).code).toBe('X'));
  it('resolves a late arrival', () => expect(resolveAttendanceCode({ isWeekend: false, schedule, mark: { entry: '08:06:00', exit: '16:00:00' } }).code).toBe('LT'));
  it.each(['08:30:00', '08:31:00', '08:34:00', '08:35:00'])('allows five minutes of grace for arrival at %s', (entry) => {
    expect(resolveAttendanceCode({ isWeekend: false, schedule: { startTime: '08:30:00', endTime: '16:30:00' }, mark: { entry, exit: '16:30:00' } })).toMatchObject({ code: 'X', status: 'PRESENT' });
  });
  it('marks arrival after the grace period as late', () => {
    expect(resolveAttendanceCode({ isWeekend: false, schedule: { startTime: '08:30:00', endTime: '16:30:00' }, mark: { entry: '08:36:00', exit: '16:30:00' } })).toMatchObject({ code: 'LT', status: 'LATE' });
  });
  it.each([
    ['VACATION', 'V'], ['HOLIDAY', 'A'], ['GOVERNMENT_VACATION', 'ACV'], ['UNPAID_LEAVE', 'LNR'],
  ] as const)('resolves %s as %s', (kind, code) => expect(resolveAttendanceCode({ isWeekend: false, schedule, incidents: [{ kind, description: 'Novedad', affectsVacationBalance: true }] }).code).toBe(code));
  it('keeps vacation priority over biometrics', () => expect(resolveAttendanceCode({ isWeekend: false, schedule, mark: { entry: '08:20:00', exit: '16:00:00' }, incidents: [{ kind: 'VACATION', description: 'Vacación' }] }).code).toBe('V'));
  it('does not invent a code without biometric id/mark', () => expect(resolveAttendanceCode({ isWeekend: false, schedule }).status).toBe('NO_DATA'));
  it('does not evaluate lateness without schedule', () => expect(resolveAttendanceCode({ isWeekend: false, schedule: null, mark: { entry: '08:00:00', exit: '16:00:00' } }).status).toBe('NO_SCHEDULE'));
  it('reports missing entry', () => expect(resolveAttendanceCode({ isWeekend: false, schedule, mark: { entry: null, exit: '16:00:00' } }).status).toBe('MISSING_ENTRY'));
  it('reports missing exit', () => expect(resolveAttendanceCode({ isWeekend: false, schedule, mark: { entry: '08:00:00', exit: null } }).status).toBe('MISSING_EXIT'));
  it('reports both marks missing', () => expect(resolveAttendanceCode({ isWeekend: false, schedule, mark: { entry: null, exit: null } }).status).toBe('MISSING_BOTH'));
});
