jest.mock('../push-notifications/push-notifications.service', () => ({
  PushNotificationsService: class {},
}));
jest.mock('../../common/helpers/send-email.helper', () => ({
  sendRequestNotification: jest.fn().mockResolvedValue({ accepted: true }),
}));

import { Readable } from 'stream';
import { sendRequestNotification } from '../../common/helpers/send-email.helper';
import {
  finalLeaveDocumentKinds,
  LeaveRequestsService,
} from './leave-requests.service';
import { LeaveRequestType } from './enums/leave-request.enums';
import { VacationPeriodStatus } from '../../common/enums/vacation.enums';

describe('LeaveRequestsService business rules', () => {
  const rawHolidays: Array<{ date: string }> = [];
  const holidayQuery = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest
      .fn()
      .mockImplementation(() => Promise.resolve(rawHolidays)),
  };
  const service = new LeaveRequestsService(
    {} as any,
    {} as any,
    {} as any,
    { createQueryBuilder: () => holidayQuery } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    rawHolidays.splice(0);
    jest.clearAllMocks();
  });

  it('counts Monday through Friday and excludes active holidays', async () => {
    rawHolidays.push({ date: '2026-08-12' });
    const days = await (service as any).countBusinessDays(
      '2026-08-10',
      '2026-08-14',
    );
    expect(days).toBe(4);
  });

  it('does not count weekends', async () => {
    const days = await (service as any).countBusinessDays(
      '2026-08-14',
      '2026-08-17',
    );
    expect(days).toBe(2);
  });

  it('moves accreditation exactly ten calendar days for a ten-day unpaid leave', async () => {
    const period = {
      id: 'period-1',
      employeeId: 'employee-1',
      periodNumber: 1,
      startDate: '2025-08-10',
      endDate: '2026-08-09',
      accreditationDate: '2026-08-10',
      status: VacationPeriodStatus.PENDING,
    };
    const inserted: Array<{ target: unknown; value: any }> = [];
    const manager = {
      find: jest.fn().mockResolvedValue([period]),
      save: jest
        .fn()
        .mockImplementation((_entity, value) => Promise.resolve(value)),
      insert: jest.fn().mockImplementation((target, value) => {
        inserted.push({ target, value });
        return Promise.resolve();
      }),
    };
    const request: any = {
      id: 'leave-1',
      requestNumber: 'SOL-000001',
      employeeId: 'employee-1',
      startDate: '2026-08-10',
      endDate: '2026-08-21',
      businessDays: 10,
      type: LeaveRequestType.UNPAID,
      reason: 'Prueba',
      vacationImpactApplied: false,
    };

    await (service as any).applyUnpaidLeaveImpact(request, manager);

    expect(period.accreditationDate).toBe('2026-08-20');
    expect(period.endDate).toBe('2026-08-19');
    expect(request.vacationImpactApplied).toBe(true);
    expect(inserted[0].value.days).toBe(10);
    expect(inserted[1].value.shiftDays).toBe(10);
  });

  it('does not apply vacation impact twice', async () => {
    const manager = { insert: jest.fn(), find: jest.fn(), save: jest.fn() };
    await (service as any).applyUnpaidLeaveImpact(
      { type: LeaveRequestType.UNPAID, vacationImpactApplied: true },
      manager,
    );
    expect(manager.insert).not.toHaveBeenCalled();
  });
});

describe('LeaveRequestsService final documents', () => {
  const pdf = () => {
    const stream = Readable.from([Buffer.from('%PDF-test')]) as Readable & {
      end: () => void;
    };
    stream.end = jest.fn();
    return stream;
  };
  const printer = { createPdf: jest.fn(() => pdf()) };
  const push = { sendToEmployee: jest.fn().mockResolvedValue(undefined) };
  const service = new LeaveRequestsService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    printer as any,
    {} as any,
    push as any,
  );
  const request = (businessDays: number, status: string = 'APPROVED') =>
    ({
      id: 'leave-1',
      requestNumber: 'LIC-000001',
      businessDays,
      status,
      type: LeaveRequestType.PAID,
      reasonType: 'DEATH',
      reason: 'Duelo familiar',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
      directorObservation: null,
      hrObservation: null,
      employee: {
        id: 'employee-1',
        email: 'employee@example.com',
        firstName: 'LILIANA',
        lastName: 'VASQUEZ',
        jobRecords: [],
      },
    }) as any;

  beforeEach(() => jest.clearAllMocks());

  it.each([[1], [3]])(
    'selects only the final resolution for %i business days',
    (days) => {
      expect(finalLeaveDocumentKinds(days)).toEqual(['FINAL']);
    },
  );
  it.each([[4], [10]])(
    'selects both documents for %i business days',
    (days) => {
      expect(finalLeaveDocumentKinds(days)).toEqual(['DIRECTOR', 'FINAL']);
    },
  );
  it('emails one PDF when a three-day leave is approved', async () => {
    await (service as any).notifyFinalDecision(request(3));
    const attachments = (sendRequestNotification as jest.Mock).mock.calls[0][6];
    expect(attachments).toHaveLength(1);
    expect(attachments[0]).toMatchObject({
      filename: 'resolucion-final-LIC-000001.pdf',
      contentType: 'application/pdf',
    });
  });
  it('emails both PDFs when a four-day leave is finally approved', async () => {
    await (service as any).notifyFinalDecision(request(4));
    const attachments = (sendRequestNotification as jest.Mock).mock.calls[0][6];
    expect(attachments.map((item: any) => item.filename)).toEqual([
      'oficio-rrhh-direccion-LIC-000001.pdf',
      'resolucion-final-LIC-000001.pdf',
    ]);
  });
  it('does not attach an approval resolution to a rejected leave', async () => {
    await (service as any).notifyFinalDecision(request(3, 'REJECTED'));
    expect((sendRequestNotification as jest.Mock).mock.calls[0][6]).toEqual([]);
  });
});
