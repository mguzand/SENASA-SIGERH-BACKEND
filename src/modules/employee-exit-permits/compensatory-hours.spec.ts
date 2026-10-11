import { EmployeeExitPermitsService } from './employee-exit-permits.service';

describe('Cálculo de horas compensatorias', () => {
  const calculate = (scheduledExit: number, actualExit: number) =>
    (EmployeeExitPermitsService.prototype as any).calculateCompensatoryMinutes(
      scheduledExit,
      actualExit,
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
});
