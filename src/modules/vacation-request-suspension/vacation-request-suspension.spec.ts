import { buildReverseRestorationPlan } from './vacation-request-suspension.service';

describe('Vacation suspension restoration', () => {
  const details = [
    { id: 'old', vacationPeriodId: 'period-old', periodStartDate: '2024-01-01', daysUsed: 3 },
    { id: 'new', vacationPeriodId: 'period-new', periodStartDate: '2025-01-01', daysUsed: 2 },
  ];

  it('returns days to the newest consumed period first', () => {
    expect(buildReverseRestorationPlan(details, 1)).toEqual({
      plan: [{ detailId: 'new', vacationPeriodId: 'period-new', days: 1 }],
      remaining: 0,
    });
  });

  it('continues with the older period when necessary', () => {
    expect(buildReverseRestorationPlan(details, 3)).toEqual({
      plan: [
        { detailId: 'new', vacationPeriodId: 'period-new', days: 2 },
        { detailId: 'old', vacationPeriodId: 'period-old', days: 1 },
      ],
      remaining: 0,
    });
  });

  it('reports an uncovered remainder instead of inventing balance', () => {
    expect(buildReverseRestorationPlan(details, 6).remaining).toBe(1);
  });
});
