import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { Regional } from '../regional/entities/regional.entity';
import { AreaManager } from './entities/area-manager.entity';
import { RegionalManager } from './entities/regional-manager.entity';
import { AreaManagerRole } from './interfaces/area-manager-role.enum';
import { RegionalManagerRole } from './interfaces/regional-manager-role.enum';

export type ApprovalScope = 'AREA' | 'REGIONAL';

export interface ResolvedApprovalManager {
  employeeId: string;
  employee: Employee;
  areaId: string;
  regionalId: string;
  scope: ApprovalScope;
}

@Injectable()
export class ApprovalRoutingService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(Regional)
    private readonly regionalRepository: Repository<Regional>,
    @InjectRepository(AreaManager)
    private readonly areaManagerRepository: Repository<AreaManager>,
    @InjectRepository(RegionalManager)
    private readonly regionalManagerRepository: Repository<RegionalManager>,
  ) {}

  async resolve(
    employeeId: string,
    _requestedAreaId: string,
  ): Promise<ResolvedApprovalManager> {
    const employee = await this.employeeRepository.findOne({
      where: { id: employeeId },
      relations: {
        regional: true,
        jobRecords: { area: true },
      },
    });

    if (!employee?.regional || !employee.regional.is_active) {
      throw new BadRequestException(
        'El empleado no tiene una regional activa configurada.',
      );
    }

    const activeJob = employee.jobRecords
      ?.filter(
        (record) => String(record.status || '').toLowerCase() === 'active',
      )
      .sort((left, right) => {
        const currentDifference = Number(Boolean(right.isCurrent)) - Number(Boolean(left.isCurrent));
        if (currentDifference) return currentDifference;
        return new Date(right.startDate || 0).getTime() - new Date(left.startDate || 0).getTime();
      })[0];
    if (!activeJob?.area_id) {
      throw new BadRequestException(
        'El empleado no tiene una unidad organizacional activa configurada.',
      );
    }

    const mainRegional = await this.regionalRepository.findOne({
      where: { is_main_office: true, is_active: true },
    });

    if (!mainRegional) {
      throw new BadRequestException(
        'No existe una regional principal activa configurada.',
      );
    }

    // Use both sources. The regional_id comparison is authoritative and avoids
    // routing a main-office employee as regional when an ORM relation/cache
    // carries a stale is_main_office value.
    const isMainOffice =
      employee.regional_id === mainRegional.id ||
      employee.regional.id === mainRegional.id ||
      Boolean(employee.regional.is_main_office);

    if (!isMainOffice) {
      const regionalManager = await this.getRegionalManager(
        employee.regional.id,
      );

      if (regionalManager.employee_id !== employee.id) {
        return this.mapRegionalManager(
          regionalManager,
          activeJob.area_id,
          employee.regional.id,
        );
      }

      const mainManager = await this.getRegionalManager(mainRegional.id);
      if (mainManager.employee_id === employee.id) {
        throw new BadRequestException(
          'No existe un aprobador superior diferente al empleado solicitante.',
        );
      }

      return this.mapRegionalManager(
        mainManager,
        activeJob.area_id,
        employee.regional.id,
      );
    }

    return this.resolveAreaOrMainManager(
      employee.id,
      activeJob.area_id,
      employee.regional.id,
    );
  }

  /**
   * Finds the nearest active boss/delegate in the organizational hierarchy.
   * The requester is always excluded, preventing self-approval. If the active
   * manager of the current unit is the requester, traversal continues at its
   * parent and repeats until a different manager is found.
   */
  async resolveAreaOrMainManager(
    employeeId: string,
    areaId: string,
    regionalId: string,
  ): Promise<ResolvedApprovalManager> {
    let currentAreaId: string | null = areaId;
    const visited = new Set<string>();

    while (currentAreaId && !visited.has(currentAreaId)) {
      visited.add(currentAreaId);
      const manager = await this.areaManagerRepository.findOne({
        where: {
          area_id: currentAreaId,
          role: AreaManagerRole.BOSS,
          is_active: true,
        },
        relations: { employee: true },
        order: { created_at: 'DESC' },
      });

      if (manager?.employee && manager.employee_id !== employeeId) {
        return {
          employeeId: manager.employee_id,
          employee: manager.employee,
          areaId: currentAreaId,
          regionalId,
          scope: 'AREA',
        };
      }

      const rows = await this.areaManagerRepository.manager.query(
        `SELECT parent_id
           FROM organizational_units
          WHERE id = $1
            AND is_active = true
          LIMIT 1`,
        [currentAreaId],
      );
      currentAreaId = rows[0]?.parent_id || null;
    }

    const mainRegional = await this.regionalRepository.findOne({
      where: { is_main_office: true, is_active: true },
    });
    if (!mainRegional) {
      throw new BadRequestException(
        'No existe una regional principal activa configurada.',
      );
    }
    const mainManager = await this.getRegionalManager(mainRegional.id);
    if (mainManager.employee_id === employeeId) {
      throw new BadRequestException(
        'No existe un aprobador superior diferente al empleado solicitante.',
      );
    }
    return this.mapRegionalManager(mainManager, areaId, regionalId);
  }

  private async getRegionalManager(regionalId: string) {
    const manager = await this.regionalManagerRepository.findOne({
      where: { regional_id: regionalId, is_active: true, role: RegionalManagerRole.REGIONAL_MANAGER },
      relations: { employee: true },
      order: { created_at: 'DESC' },
    });

    if (!manager?.employee) {
      throw new BadRequestException(
        'La regional no tiene un jefe regional activo configurado.',
      );
    }

    return manager;
  }

  private mapRegionalManager(
    manager: RegionalManager,
    areaId: string,
    regionalId: string,
  ): ResolvedApprovalManager {
    return {
      employeeId: manager.employee_id,
      employee: manager.employee,
      areaId,
      regionalId,
      scope: 'REGIONAL',
    };
  }
}
