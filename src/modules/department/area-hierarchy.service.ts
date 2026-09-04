import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationalUnit } from './entities/organizational-unit.entity';
import { MoveOrganizationalUnitDto } from './dto/move-organizational-unit.dto';
import { HierarchyUnit, validateAreaMove } from './area-hierarchy.rules';

@Injectable()
export class AreaHierarchyService {
  constructor(
    @InjectRepository(OrganizationalUnit)
    private readonly units: Repository<OrganizationalUnit>,
    private readonly config: ConfigService,
  ) {}

  async assertAccess(userId?: string) {
    if (!userId) throw new ForbiddenException('Debe iniciar sesión.');
    const permissions = await this.units.manager.query(
      `SELECT 1 FROM roles_user ru
       JOIN components c ON c.components_id = ru.component_id
       JOIN users u ON u.id::text = ru.user_id::text
       WHERE ru.user_id::text = $1 AND u.is_active = true
         AND c.system_id = $2 AND c.visible = true
         AND c.description = 'Gestión de áreas' LIMIT 1`,
      [
        String(userId),
        this.config.get<string>(
          'DEFAULT_SYSTEM_ID',
          '6816a2e5-085a-4d96-8a36-a8546d886051',
        ),
      ],
    );
    if (!permissions.length)
      throw new ForbiddenException('No tiene permiso para gestionar áreas.');
  }

  async findHierarchy(userId?: string) {
    await this.assertAccess(userId);
    return this.units.manager.query(
      `SELECT u.id, u.code, u.name, u.parent_id, u.is_active,
              u.is_main_office, u.description, t.name AS type_name
       FROM organizational_units u
       LEFT JOIN organizational_unit_types t ON t.id = u.unit_type
       ORDER BY u.name, u.code, u.id`,
    );
  }

  async move(id: string, dto: MoveOrganizationalUnitDto, userId?: string) {
    await this.assertAccess(userId);
    return this.units.manager.transaction(async (manager) => {
      // Serialize hierarchy writes so simultaneous A→B / B→A moves cannot create a cycle.
      await manager.query(
        'LOCK TABLE organizational_units IN SHARE ROW EXCLUSIVE MODE',
      );
      const units: HierarchyUnit[] = await manager.query(
        'SELECT id, parent_id, is_active FROM organizational_units',
      );
      validateAreaMove(units, id, dto.parentId, dto.expectedParentId);
      if (dto.parentId !== dto.expectedParentId) {
        await manager.query(
          'UPDATE organizational_units SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [dto.parentId, id],
        );
      }
      return {
        id,
        parentId: dto.parentId,
        message: 'Estructura actualizada correctamente.',
      };
    });
  }
}
