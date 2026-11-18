import { EmployeeExitPermitsService } from './employee-exit-permits.service';

describe('Cálculo de horas compensatorias', () => {
  const calculate = (scheduledExit: number, actualExit: number) =>
    (EmployeeExitPermitsService.prototype as any).calculateCompensatoryMinutes(
      scheduledExit,
      actualExit,
    );
  const calculateEarly = (scheduledEntry: number, actualEntry: number) =>
    (EmployeeExitPermitsService.prototype as any).calculateEarlyCompensatoryMinutes(
      scheduledEntry,
      actualEntry,
    );

  it('no acredita una jornada con menos de dos horas adicionales', () => {
    expect(calculate(16 * 60 + 30, 18 * 60 + 29)).toBe(0);
  });

  it('acredita las dos horas completas al alcanzar el mínimo', () => {
    expect(calculate(16 * 60 + 30, 18 * 60 + 30)).toBe(120);
  });

  it('acredita tres horas para una salida de 16:30 a 19:30', () => {
    expect(calculate(16 * 60 + 30, 19 * 60 + 30)).toBe(180);
  });

  it('no acredita una entrada con una hora y 59 minutos de anticipación', () => {
    expect(calculateEarly(8 * 60 + 30, 6 * 60 + 31)).toBe(0);
  });

  it('acredita dos horas al entrar dos horas antes', () => {
    expect(calculateEarly(8 * 60 + 30, 6 * 60 + 30)).toBe(120);
  });

  it('acredita tres horas al entrar tres horas antes', () => {
    expect(calculateEarly(8 * 60 + 30, 5 * 60 + 30)).toBe(180);
  });
});
