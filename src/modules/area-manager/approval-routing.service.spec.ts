import { BadRequestException } from '@nestjs/common';
import { ApprovalRoutingService } from './approval-routing.service';

describe('ApprovalRoutingService', () => {
  const mainRegional = {
    id: 'regional-main',
    is_main_office: true,
    is_active: true,
  };
  const secondaryRegional = {
    id: 'regional-secondary',
    is_main_office: false,
    is_active: true,
  };
  const areaManagerEmployee = { id: 'area-boss', firstName: 'Jefe' };
  const parentManagerEmployee = { id: 'parent-boss', firstName: 'Superior' };
  const mainManagerEmployee = { id: 'director', firstName: 'Director' };
  const secondaryManagerEmployee = {
    id: 'regional-boss',
    firstName: 'Regional',
  };

  let employee: any;
  let areaManagers: Record<string, any>;
  let areaParents: Record<string, string | null>;
  let regionalManagers: Record<string, any>;
  let service: ApprovalRoutingService;

  beforeEach(() => {
    employee = {
      id: 'employee',
      regional: mainRegional,
      jobRecords: [
        {
          area_id: 'area-1',
          status: 'ACTIVE',
          area: { id: 'area-1' },
        },
      ],
    };
    areaManagers = {
      'area-1': {
        employee_id: areaManagerEmployee.id,
        employee: areaManagerEmployee,
      },
    };
    areaParents = { 'area-1': 'area-parent', 'area-parent': null };
    regionalManagers = {
      [mainRegional.id]: {
        employee_id: mainManagerEmployee.id,
        employee: mainManagerEmployee,
      },
      [secondaryRegional.id]: {
        employee_id: secondaryManagerEmployee.id,
        employee: secondaryManagerEmployee,
      },
    };

    const employeeRepository = {
      findOne: jest.fn().mockImplementation(() => Promise.resolve(employee)),
    };
    const regionalRepository = {
      findOne: jest.fn().mockResolvedValue(mainRegional),
    };
    const areaManagerRepository = {
      findOne: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(areaManagers[where.area_id] || null),
      ),
      manager: {
        query: jest.fn().mockImplementation((_sql: string, [areaId]: string[]) =>
          Promise.resolve([{ parent_id: areaParents[areaId] || null }]),
        ),
      },
    };
    const regionalManagerRepository = {
      findOne: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(regionalManagers[where.regional_id] || null),
      ),
    };

    service = new ApprovalRoutingService(
      employeeRepository as any,
      regionalRepository as any,
      areaManagerRepository as any,
      regionalManagerRepository as any,
    );
  });

  it('routes a secondary regional employee to that regional manager', async () => {
    employee.regional = secondaryRegional;

    const result = await service.resolve(employee.id, 'area-1');

    expect(result.employeeId).toBe(secondaryManagerEmployee.id);
    expect(result.scope).toBe('REGIONAL');
    expect(result.regionalId).toBe(secondaryRegional.id);
  });

  it('escalates a secondary regional manager own request to the main manager', async () => {
    employee.id = secondaryManagerEmployee.id;
    employee.regional = secondaryRegional;

    const result = await service.resolve(employee.id, 'area-1');

    expect(result.employeeId).toBe(mainManagerEmployee.id);
    expect(result.scope).toBe('REGIONAL');
  });

  it('routes a regular main-office employee to the active area manager', async () => {
    const result = await service.resolve(employee.id, 'area-1');

    expect(result.employeeId).toBe(areaManagerEmployee.id);
    expect(result.scope).toBe('AREA');
  });

  it('escalates a main-office boss or delegate to the parent unit manager', async () => {
    areaManagers['area-1'] = { employee_id: employee.id, employee };
    areaManagers['area-parent'] = {
      employee_id: parentManagerEmployee.id,
      employee: parentManagerEmployee,
    };

    const result = await service.resolve(employee.id, 'area-1');

    expect(result.employeeId).toBe(parentManagerEmployee.id);
    expect(result.areaId).toBe('area-parent');
    expect(result.scope).toBe('AREA');
  });

  it('prevents self-approval when no different area or regional manager exists', async () => {
    employee.id = mainManagerEmployee.id;
    areaManagers = {};

    await expect(service.resolve(employee.id, 'area-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('ignores a stale submitted area and routes with the active job area', async () => {
    const result = await service.resolve(employee.id, 'old-area-from-token');

    expect(result.areaId).toBe('area-1');
    expect(result.employeeId).toBe(areaManagerEmployee.id);
  });
});
