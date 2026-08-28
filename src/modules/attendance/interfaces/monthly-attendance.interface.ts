export const ATTENDANCE_CODE_CATALOG = [
  ['PP', 'PERMISO PERSONAL'], ['PO', 'PERMISO OFICIAL'], ['OT', 'OTROS PERMISOS'], ['CM', 'CITA MEDICA'],
  ['PS', 'PERMISO DE SALUD'], ['I', 'INCAPACIDAD'], ['LT', 'LLEGADA TARDIA'],
  ['PTE', 'TERAPIA'], ['D', 'DEDUCCION DIA COMPLETO'], ['DC', 'DIA COMPENSATORIO'],
  ['V', 'VACACION'], ['VP', 'VACACION PROFILACTICA'],
  ['ACV', 'ASUETO A CUENTA DE VACACIONES'], ['A', 'SOLO PARA ASUETOS'],
  ['LR/D', 'LICENCIA REMUNERADA DE DUELO'], ['LR/N', 'LICENCIA REMUNERADA POR NUPCIAS'],
  ['LR/CAL', 'LICENCIA REMUNERADA CALAMIDAD'], ['LR/CUI', 'LICENCIA REMUNERADA POR CUIDADOS'],
  ['LNR', 'LICENCIA NO REMUNERADA'], ['PE', 'PERMISO DE ESTUDIO'],
  ['PRN', 'PRENATAL'], ['PSNT', 'POSTNATAL'],
] as const;

export interface MonthlyAttendanceDay { number: number; date: string; weekday: string; weekdayShort: string; }
export interface AttendanceDayResult {
  code: string | null;
  status: string;
  description: string;
  entry: string | null;
  exit: string | null;
  scheduledEntry?: string | null;
  scheduledExit?: string | null;
  source: 'ADMINISTRATIVE' | 'BIOMETRIC' | 'SYSTEM' | null;
  requiresClassification?: boolean;
}
export interface MonthlyAttendanceReport {
  period: { month: number; year: number; monthName: string };
  regional: { id: string | null; name: string };
  days: MonthlyAttendanceDay[];
  employees: Array<{
    id: string; biometricId: string | null; name: string; regional: string;
    organizationalUnit: string; schedule: { startTime: string; endTime: string } | null;
    days: Record<number, AttendanceDayResult>; observations: string;
  }>;
  warnings: string[];
}

export interface AttendanceIncident {
  kind: 'VACATION' | 'HOLIDAY' | 'GOVERNMENT_VACATION' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'PERMIT';
  description: string;
  affectsVacationBalance?: boolean;
  permitType?: string;
}

export interface BiometricMark { entry: string | null; exit: string | null; }
