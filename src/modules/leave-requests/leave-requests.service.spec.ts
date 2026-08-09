import { LeaveRequestsService } from './leave-requests.service';
import { LeaveRequestType } from './enums/leave-request.enums';
import { VacationPeriodStatus } from '../../common/enums/vacation.enums';

describe('LeaveRequestsService business rules', () => {
  const rawHolidays: Array<{ date: string }> = [];
  const holidayQuery = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockImplementation(() => Promise.resolve(rawHolidays)),
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
    const days = await (service as any).countBusinessDays('2026-08-10', '2026-08-14');
    expect(days).toBe(4);
  });

  it('does not count weekends', async () => {
    const days = await (service as any).countBusinessDays('2026-08-14', '2026-08-17');
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
      save: jest.fn().mockImplementation((_entity, value) => Promise.resolve(value)),
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
