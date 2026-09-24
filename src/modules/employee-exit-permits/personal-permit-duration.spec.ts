import { EmployeeExitPermitsService } from './employee-exit-permits.service';

describe('Clasificación de pases personales', () => {
  const classify = (
    exitTime: string,
    returnTime: string | undefined,
    withoutReturn: boolean,
    schedule: { startTime: string; endTime: string },
  ) =>
    (EmployeeExitPermitsService.prototype as any).classifyPersonalPermit(
      exitTime,
      returnTime,
      withoutReturn,
      schedule,
    );

  it('clasifica como medio día una salida a las 12:00 sin retorno en horario 08:30-16:30', () => {
    expect(
      classify('12:00:00', undefined, true, {
        startTime: '08:30:00',
        endTime: '16:30:00',
      }),
    ).toBe('HALF');
  });

  it('mantiene como completo un pase que cruza las 12:00 en horario 08:30-16:30', () => {
    expect(
      classify('11:30:00', undefined, true, {
        startTime: '08:30:00',
        endTime: '16:30:00',
      }),
    ).toBe('FULL');
  });

  it('mantiene el máximo de cuatro horas para otros horarios', () => {
    expect(
      classify('12:00:00', undefined, true, {
        startTime: '08:00:00',
        endTime: '16:30:00',
      }),
    ).toBe('FULL');
  });
});
