import {
  LeaveRequestType,
  LeaveReasonType,
} from '../enums/leave-request.enums';
import {
  buildFinalLeaveDecisionReport,
  buildHrToDirectorLeaveReport,
} from './leave-request.report';

const request = {
  requestNumber: 'LIC-000001',
  businessDays: 3,
  type: LeaveRequestType.PAID,
  reasonType: LeaveReasonType.DEATH,
  reason: 'fallecimiento de un familiar',
  startDate: '2026-06-01',
  endDate: '2026-06-03',
  employee: {
    firstName: 'LILIANA',
    middleName: 'MARIBEL',
    lastName: 'VASQUEZ',
    secondLastName: 'AVILA',
    jobRecords: [
      {
        isCurrent: true,
        status: 'ACTIVE',
        position: { name: 'Conserje' },
        modality: { name: 'Acuerdo' },
      },
    ],
  },
} as any;
const contentText = (definition: object) => JSON.stringify(definition);

describe('Leave request PDF formats', () => {
  it('keeps the HR to Director General memo for long leaves', () => {
    const text = contentText(
      buildHrToDirectorLeaveReport({ ...request, businessDays: 4 }),
    );
    expect(text).toContain('ING. KEVIN ERNESTO MENDOZA LIRA');
    expect(text).toContain('DR. RAFAEL ENRIQUE RODRIGUEZ ALVARADO');
    expect(text).toContain('La Dirección de Recursos Humanos y Capacitación');
  });
  it('addresses the final resolution from the Director General to the employee', () => {
    const text = contentText(buildFinalLeaveDecisionReport(request));
    expect(text).toContain('LILIANA MARIBEL VASQUEZ AVILA');
    expect(text).toContain('CONSERJE');
    expect(text).toContain('DIRECTOR GENERAL DEL SENASA');
    expect(text).toContain('esta Dirección General establece');
    expect(text).toContain('director-general-signature.jpg');
    expect(text).not.toContain('ING. KEVIN ERNESTO MENDOZA LIRA');
  });
  it('uses the active nominal position, modality and written period dates', () => {
    const text = contentText(buildFinalLeaveDecisionReport(request));
    expect(text).toContain('modalidad de Acuerdo');
    expect(text).toContain('lunes primero (01) de junio del 2026');
    expect(text).toContain('miércoles tres (03) de junio del 2026');
  });
});
