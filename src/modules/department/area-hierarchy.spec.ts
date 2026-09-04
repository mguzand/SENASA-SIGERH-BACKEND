import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { validateAreaMove } from './area-hierarchy.rules';
import { AreaHierarchyService } from './area-hierarchy.service';
import { MoveOrganizationalUnitDto } from './dto/move-organizational-unit.dto';

describe('Area hierarchy rules', () => {
  const units = [
    { id: 'a', parent_id: null, is_active: true },
    { id: 'b', parent_id: 'a', is_active: true },
    { id: 'c', parent_id: 'b', is_active: true },
    { id: 'd', parent_id: null, is_active: true },
    { id: 'inactive', parent_id: null, is_active: false },
  ];
  it('allows a move without changing descendants or the input', () => {
    const snapshot = JSON.stringify(units);
    expect(() => validateAreaMove(units, 'b', 'd', 'a')).not.toThrow();
    expect(JSON.stringify(units)).toBe(snapshot);
  });
  it('allows moving a child to the root', () =>
    expect(() => validateAreaMove(units, 'b', null, 'a')).not.toThrow());
  it('allows an unchanged parent', () =>
    expect(() => validateAreaMove(units, 'b', 'a', 'a')).not.toThrow());
  it('rejects self parenting', () =>
    expect(() => validateAreaMove(units, 'a', 'a', null)).toThrow(
      BadRequestException,
    ));
  it('rejects a direct descendant as parent', () =>
    expect(() => validateAreaMove(units, 'a', 'b', null)).toThrow(
      BadRequestException,
    ));
  it('rejects a deeply nested descendant', () =>
    expect(() => validateAreaMove(units, 'a', 'c', null)).toThrow(
      BadRequestException,
    ));
  it('rejects stale moves', () =>
    expect(() => validateAreaMove(units, 'b', 'd', null)).toThrow(
      ConflictException,
    ));
  it('rejects missing sources', () =>
    expect(() => validateAreaMove(units, 'missing', null, null)).toThrow(
      NotFoundException,
    ));
  it('rejects missing parents', () =>
    expect(() => validateAreaMove(units, 'a', 'missing', null)).toThrow(
      NotFoundException,
    ));
  it('rejects inactive destinations', () =>
    expect(() => validateAreaMove(units, 'a', 'inactive', null)).toThrow(
      BadRequestException,
    ));
  it('rejects existing cycles in the destination', () => {
    expect(() =>
      validateAreaMove(
        [
          ...units,
          { id: 'x', parent_id: 'y', is_active: true },
          { id: 'y', parent_id: 'x', is_active: true },
        ],
        'a',
        'x',
        null,
      ),
    ).toThrow(BadRequestException);
  });
  it('can repair a legacy cycle by moving to root', () => {
    expect(() =>
      validateAreaMove(
        [{ id: 'x', parent_id: 'x', is_active: true }],
        'x',
        null,
        'x',
      ),
    ).not.toThrow();
  });
});

describe('Area move request validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  it('rejects an omitted parent at the HTTP boundary', async () => {
    await expect(
      pipe.transform(
        { expectedParentId: null },
        { type: 'body', metatype: MoveOrganizationalUnitDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejects unrelated changes at the HTTP boundary', async () => {
    await expect(
      pipe.transform(
        { parentId: null, expectedParentId: null, name: 'No cambiar' },
        { type: 'body', metatype: MoveOrganizationalUnitDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('requires both fields', async () =>
    expect(await validate(new MoveOrganizationalUnitDto())).toHaveLength(2));
  it('accepts explicit nulls for the root', async () => {
    expect(
      await validate(
        Object.assign(new MoveOrganizationalUnitDto(), {
          parentId: null,
          expectedParentId: null,
        }),
      ),
    ).toHaveLength(0);
  });
  it('rejects invalid IDs', async () => {
    expect(
      await validate(
        Object.assign(new MoveOrganizationalUnitDto(), {
          parentId: 'invalid',
          expectedParentId: '',
        }),
      ),
    ).toHaveLength(2);
  });
});

describe('Area hierarchy persistence and permissions', () => {
  const userId = 'user-id';
  let manager: { query: jest.Mock; transaction: jest.Mock };
  let transactionManager: { query: jest.Mock };
  let service: AreaHierarchyService;
  beforeEach(() => {
    transactionManager = { query: jest.fn().mockResolvedValue([]) };
    manager = {
      query: jest.fn().mockResolvedValue([{ allowed: 1 }]),
      transaction: jest.fn((callback) => callback(transactionManager)),
    };
    service = new AreaHierarchyService(
      { manager } as any,
      { get: () => 'system-id' } as any,
    );
  });
  it('does not query or mutate for anonymous users', async () => {
    await expect(
      service.move('a', { parentId: null, expectedParentId: null }),
    ).rejects.toThrow(ForbiddenException);
    expect(manager.query).not.toHaveBeenCalled();
    expect(manager.transaction).not.toHaveBeenCalled();
  });
  it('denies reads and writes without the assigned component', async () => {
    manager.query.mockResolvedValue([]);
    await expect(service.findHierarchy(userId)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.move('a', { parentId: null, expectedParentId: null }, userId),
    ).rejects.toThrow(ForbiddenException);
    expect(manager.transaction).not.toHaveBeenCalled();
  });
  it('checks permission against the configured system and active user', async () => {
    await service.findHierarchy(userId);
    expect(manager.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('u.is_active = true'),
      [userId, 'system-id'],
    );
  });
  it('locks before validation and updates only the parent and timestamp', async () => {
    transactionManager.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: 'a', parent_id: null, is_active: true },
        { id: 'b', parent_id: null, is_active: true },
      ])
      .mockResolvedValueOnce([]);
    await expect(
      service.move('a', { parentId: 'b', expectedParentId: null }, userId),
    ).resolves.toMatchObject({ id: 'a', parentId: 'b' });
    expect(transactionManager.query).toHaveBeenNthCalledWith(
      1,
      'LOCK TABLE organizational_units IN SHARE ROW EXCLUSIVE MODE',
    );
    expect(transactionManager.query).toHaveBeenNthCalledWith(
      3,
      'UPDATE organizational_units SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['b', 'a'],
    );
  });
  it('does not write if the hierarchy changed since loading', async () => {
    transactionManager.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'a', parent_id: 'b', is_active: true }]);
    await expect(
      service.move('a', { parentId: null, expectedParentId: null }, userId),
    ).rejects.toThrow(ConflictException);
    expect(transactionManager.query).toHaveBeenCalledTimes(2);
  });
});
