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

  const validate = (
    exitTime: string,
    returnTime: string | undefined,
    withoutReturn: boolean,
  ) =>
    (EmployeeExitPermitsService.prototype as any).validatePersonalDurationSelection(
      'HALF',
      exitTime,
      returnTime,
      withoutReturn,
      { startTime: '08:30:00', endTime: '16:30:00' },
    );

  it('clasifica como completo una salida a las 12:00 sin retorno porque cruza el punto medio 12:30', () => {
    expect(
      classify('12:00:00', undefined, true, {
        startTime: '08:30:00',
        endTime: '16:30:00',
      }),
    ).toBe('FULL');
  });

  it('mantiene como completo un pase que cruza las 12:30 en horario 08:30-16:30', () => {
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

  it('acepta exactamente cuatro horas antes o después de las 12:30', () => {
    expect(() => validate('08:30:00', '12:30:00', false)).not.toThrow();
    expect(() => validate('12:30:00', undefined, true)).not.toThrow();
  });

  it('rechaza un medio día que cruza las 12:30', () => {
    expect(() => validate('08:30:00', '13:00:00', false)).toThrow(
      /no puede cruzar la hora intermedia/i,
    );
    expect(() => validate('12:00:00', undefined, true)).toThrow(
      /no puede cruzar la hora intermedia/i,
    );
  });
});
