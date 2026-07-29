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
  const mainManagerEmployee = { id: 'director', firstName: 'Director' };
  const secondaryManagerEmployee = {
    id: 'regional-boss',
    firstName: 'Regional',
  };

  let employee: any;
  let employeeIsAreaManager = false;
  let areaManager: any;
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
    employeeIsAreaManager = false;
    areaManager = {
      employee_id: areaManagerEmployee.id,
      employee: areaManagerEmployee,
    };
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
      findOne: jest.fn().mockImplementation(() => Promise.resolve(areaManager)),
      createQueryBuilder: jest.fn().mockReturnValue({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getExists: jest
          .fn()
          .mockImplementation(() => Promise.resolve(employeeIsAreaManager)),
      }),
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

  it('routes a main-office boss or delegate to the main regional manager', async () => {
    employeeIsAreaManager = true;

    const result = await service.resolve(employee.id, 'area-1');

    expect(result.employeeId).toBe(mainManagerEmployee.id);
    expect(result.scope).toBe('REGIONAL');
  });

  it('prevents the main regional manager from approving their own request', async () => {
    employee.id = mainManagerEmployee.id;
    employeeIsAreaManager = true;

    await expect(service.resolve(employee.id, 'area-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an area that differs from the active job record', async () => {
    await expect(service.resolve(employee.id, 'another-area')).rejects.toThrow(
      'El área enviada no coincide con el registro laboral activo del empleado.',
    );
  });
});
