import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface RequestHistoryEvent {
  key: string;
  label: string;
  status: string;
  occurredAt: Date | string | null;
  actorName: string | null;
  observation: string | null;
}

type RequestType = 'exit-permit' | 'vacation' | 'certificate' | 'leave';

@Injectable()
export class RequestHistoryService {
  constructor(private readonly dataSource: DataSource) {}

  async find(type: RequestType, id: string) {
    const tableByType: Record<RequestType, string> = {
      'exit-permit': 'employee_exit_permits',
      vacation: 'vacation_requests',
      certificate: 'employment_certificate_requests',
      leave: 'leave_requests',
    };
    const table = tableByType[type];
    if (!table) throw new NotFoundException('Tipo de solicitud no válido.');

    const [request] = await this.dataSource.query(
      `SELECT * FROM "${table}" WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (!request) throw new NotFoundException('Solicitud no encontrada.');

    const actorIds = this.actorIds(type, request);
    const names = await this.employeeNames(actorIds);
    const actor = (employeeId?: string | null) =>
      employeeId ? names.get(employeeId) || 'Empleado no disponible' : null;

    const events: RequestHistoryEvent[] = [
      {
        key: 'submitted',
        label: 'Solicitud creada',
        status: 'SUBMITTED',
        occurredAt: request.created_at,
        actorName: actor(request.employee_id),
        observation: this.submissionObservation(type, request),
      },
    ];

    if (type === 'exit-permit' || type === 'vacation') {
      events.push(
        this.reviewEvent('boss', 'Revisión de jefatura', request.boss_status, request.boss_reviewed_at, actor(request.boss_employee_id), request.boss_observation),
      );
      if (request.liaison_review_required) {
        events.push(
          this.reviewEvent('liaison', 'Revisión del enlace de RR. HH.', request.liaison_status, request.liaison_reviewed_at, actor(request.liaison_employee_id), request.liaison_observation),
        );
      }
      events.push(
        this.reviewEvent('hr', 'Revisión de Recursos Humanos', request.hr_status, request.hr_reviewed_at, actor(request.hr_employee_id), request.hr_observation),
      );
    }

    if (type === 'leave') {
      const managerIsRegional = request.regional_manager_employee_id != null;
      events.push(
        this.reviewEvent(
          'manager',
          managerIsRegional ? 'Revisión de jefatura regional' : 'Revisión de jefatura de área',
          managerIsRegional ? request.regional_status : request.area_status,
          managerIsRegional ? request.regional_reviewed_at : request.area_reviewed_at,
          actor(managerIsRegional ? request.regional_manager_employee_id : request.area_manager_employee_id),
          managerIsRegional ? request.regional_observation : request.area_observation,
        ),
      );
      if (request.liaison_review_required) {
        events.push(this.reviewEvent('liaison', 'Revisión del enlace de RR. HH.', request.liaison_status, request.liaison_reviewed_at, actor(request.liaison_employee_id), request.liaison_observation));
      }
      events.push(this.reviewEvent('hr', 'Revisión de Recursos Humanos', request.hr_status, request.hr_reviewed_at, actor(request.hr_employee_id), request.hr_observation));
      if (request.type === 'UNPAID') {
        events.push(this.reviewEvent('director', 'Resolución de Dirección General', request.director_status, request.director_reviewed_at, actor(request.director_employee_id), request.director_observation));
      }
    }

    if (type === 'certificate') {
      events.push(
        this.reviewEvent('processing', 'Procesamiento por Recursos Humanos', request.processed_at ? 'COMPLETED' : 'PENDING', request.processed_at, actor(request.processed_by_employee_id), request.observation),
      );
      if (request.generated_at) {
        events.push(this.reviewEvent('generated', 'PDF generado', 'COMPLETED', request.generated_at, actor(request.generated_by_employee_id), request.document_number ? `Documento ${request.document_number}` : null));
      }
      events.push(this.reviewEvent('ready', 'Constancia lista y enviada', request.ready_at ? 'COMPLETED' : request.status === 'REJECTED' ? 'SKIPPED' : 'PENDING', request.ready_at, actor(request.processed_by_employee_id), null));
      events.push(this.reviewEvent('delivered', 'Constancia entregada', request.delivered_at ? 'COMPLETED' : request.status === 'REJECTED' ? 'SKIPPED' : 'PENDING', request.delivered_at, actor(request.processed_by_employee_id), null));
    }

    return {
      requestId: id,
      requestType: type,
      currentStatus: request.status,
      currentStage: request.stage || null,
      events,
    };
  }

  private reviewEvent(
    key: string,
    label: string,
    status: string | null,
    occurredAt: Date | string | null,
    actorName: string | null,
    observation: string | null,
  ): RequestHistoryEvent {
    return { key, label, status: status || 'PENDING', occurredAt, actorName, observation };
  }

  private actorIds(type: RequestType, request: any) {
    const ids = [request.employee_id];
    if (type === 'exit-permit' || type === 'vacation') {
      ids.push(request.boss_employee_id, request.liaison_employee_id, request.hr_employee_id);
    } else if (type === 'leave') {
      ids.push(request.regional_manager_employee_id, request.area_manager_employee_id, request.liaison_employee_id, request.hr_employee_id, request.director_employee_id);
    } else {
      ids.push(request.processed_by_employee_id, request.generated_by_employee_id);
    }
    return [...new Set(ids.filter(Boolean))];
  }

  private async employeeNames(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const rows = await this.dataSource.query(
      `SELECT id, first_name, middle_name, last_name, second_last_name FROM employees WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return new Map<string, string>(
      rows.map((employee: any) => [
        employee.id,
        [employee.first_name, employee.middle_name, employee.last_name, employee.second_last_name]
          .filter(Boolean)
          .join(' '),
      ]),
    );
  }

  private submissionObservation(type: RequestType, request: any) {
    if (type === 'exit-permit') return request.description || null;
    if (type === 'vacation') return request.employee_comment || null;
    if (type === 'leave') return request.reason || null;
    return null;
  }
}
