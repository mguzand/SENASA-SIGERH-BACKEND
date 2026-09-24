import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  VacationMovementType,
  VacationRequestStatus,
} from 'src/common/enums/vacation.enums';
import { sendRequestNotification } from 'src/common/helpers/send-email.helper';
import { AreaManagerService } from '../area-manager/area-manager.service';
import { AreaManagerRole } from '../area-manager/interfaces/area-manager-role.enum';
import { EmployeeVacationPeriodService } from '../employee-vacation-period/employee-vacation-period.service';
import { Employee } from '../employees/entities/employee.entity';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { VacationMovementService } from '../vacation-movement/vacation-movement.service';
import { VacationRequestDetailService } from '../vacation-request-detail/vacation-request-detail.service';
import { VacationRequest } from '../vacation-request/entities/vacation-request.entity';
import { VacationRequestDayService } from '../vacation_request_days/vacation_request_days.service';
import { SuspendVacationRequestDto } from './dto/suspend-vacation-request.dto';
import { VacationRequestSuspension } from './entities/vacation-request-suspension.entity';
import { RescheduleVacationRequestDto } from './dto/reschedule-vacation-request.dto';
import { VacationRequestReschedule } from './entities/vacation-request-reschedule.entity';
import { VacationRequestDay } from '../vacation_request_days/entities/vacation_request_days.entity';
import { VacationRequestDayStatus } from 'src/common/enums/vacation.enums';

export function buildReverseRestorationPlan(
  details: Array<{ id: string; vacationPeriodId: string; periodStartDate: string; daysUsed: number }>,
  restoredDays: number,
) {
  let remaining = restoredDays;
  const plan: Array<{ detailId: string; vacationPeriodId: string; days: number }> = [];
  [...details]
    .sort((a, b) => b.periodStartDate.localeCompare(a.periodStartDate))
    .forEach((detail) => {
      if (remaining <= 0) return;
      const days = Math.min(Number(detail.daysUsed), remaining);
      if (days > 0) {
        plan.push({ detailId: detail.id, vacationPeriodId: detail.vacationPeriodId, days });
        remaining -= days;
      }
    });
  return { plan, remaining };
}

@Injectable()
export class VacationRequestSuspensionService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(VacationRequestSuspension)
    private readonly suspensionRepository: Repository<VacationRequestSuspension>,
    private readonly dayService: VacationRequestDayService,
    private readonly detailService: VacationRequestDetailService,
    private readonly periodService: EmployeeVacationPeriodService,
    private readonly movementService: VacationMovementService,
    private readonly areaManagerService: AreaManagerService,
    private readonly pushNotifications: PushNotificationsService,
  ) {}

  async suspend(
    vacationRequestId: string,
    dto: SuspendVacationRequestDto,
    hrEmployeeId: string,
  ) {
    if (!hrEmployeeId) {
      throw new ForbiddenException('No fue posible identificar al usuario de RR. HH.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let employee: Employee | null = null;
    let suspendedDates: string[] = [];
    let approvedDaysRemaining = 0;
    let finalStatus = VacationRequestStatus.APPROVED;

    try {
      const request = await queryRunner.manager.findOne(VacationRequest, {
        where: { id: vacationRequestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw new NotFoundException('Solicitud de vacaciones no encontrada');

      const hrAreaIds = await this.areaManagerService.findAreaIdsByEmployeeAndRole(
        hrEmployeeId,
        AreaManagerRole.HR,
      );
      if (!hrAreaIds.length && request.hr_employee_id !== hrEmployeeId) {
        throw new ForbiddenException('Solo Recursos Humanos puede suspender vacaciones.');
      }
      if (
        ![VacationRequestStatus.APPROVED, VacationRequestStatus.PARTIALLY_SUSPENDED].includes(
          request.status,
        ) ||
        request.hr_status !== VacationRequestStatus.APPROVED
      ) {
        throw new BadRequestException('Solo se pueden suspender vacaciones aprobadas por RR. HH.');
      }
      if (!request.is_processed) {
        throw new BadRequestException('La solicitud todavía no ha sido procesada contra el saldo.');
      }

      const today = this.todayInTegucigalpa();
      const suspensionDate = dto.suspend_all_remaining
        ? String(dto.suspension_date || '')
        : today;
      if (dto.suspend_all_remaining && suspensionDate < today) {
        throw new BadRequestException('La fecha de suspensión no puede ser anterior a hoy.');
      }

      const days = dto.suspend_all_remaining
        ? await this.dayService.findRemainingWithManager(
            request.id,
            suspensionDate,
            today,
            queryRunner.manager,
          )
        : await this.dayService.findSuspendibleWithManager(
            request.id,
            [...new Set(dto.days || [])],
            today,
            queryRunner.manager,
          );

      if (!dto.suspend_all_remaining && days.length !== new Set(dto.days || []).size) {
        throw new BadRequestException(
          'Uno o más días no pertenecen a la solicitud, ya pasaron o ya fueron suspendidos.',
        );
      }
      if (!days.length) {
        throw new BadRequestException('No hay días válidos disponibles para suspender.');
      }

      const restoredDays = days.length;
      const suspension = await queryRunner.manager.save(
        VacationRequestSuspension,
        queryRunner.manager.create(VacationRequestSuspension, {
          vacation_request_id: request.id,
          hr_employee_id: hrEmployeeId,
          suspension_date: dto.suspend_all_remaining ? suspensionDate : today,
          reason: dto.reason,
          restored_days: restoredDays,
          suspend_all_remaining: Boolean(dto.suspend_all_remaining),
        }),
      );

      const details = await this.detailService.findByRequestWithManager(
        request.id,
        queryRunner.manager,
      );
      const restoration = buildReverseRestorationPlan(
        details.map((detail) => ({
          id: detail.id,
          vacationPeriodId: detail.vacationPeriodId,
          periodStartDate: String(detail.vacationPeriod?.startDate || ''),
          daysUsed: Number(detail.daysUsed),
        })),
        restoredDays,
      );
      if (restoration.remaining > 0) {
        throw new BadRequestException(
          'Los consumos originales de la solicitud no permiten completar la devolución.',
        );
      }

      for (const item of restoration.plan) {
        const detail = details.find((candidate) => candidate.id === item.detailId)!;
        const restore = item.days;

        await this.periodService.restoreVacationDaysWithManager(
          item.vacationPeriodId,
          restore,
          queryRunner.manager,
        );
        detail.daysUsed = Number(detail.daysUsed) - restore;
        await this.detailService.saveWithManager(detail, queryRunner.manager);
        await this.movementService.createWithManager(
          {
            employeeId: request.employee_id,
            vacationPeriodId: detail.vacationPeriodId,
            vacationRequestId: request.id,
            type: VacationMovementType.SUSPENSION,
            days: restore,
            movementDate: suspension.suspension_date,
            description: dto.reason,
            createdByUserId: hrEmployeeId,
          },
          queryRunner.manager,
        );
      }

      await this.dayService.markSuspendedWithManager(days, suspension.id, queryRunner.manager);
      approvedDaysRemaining = await this.dayService.countApprovedWithManager(
        request.id,
        queryRunner.manager,
      );
      finalStatus = approvedDaysRemaining > 0
        ? VacationRequestStatus.PARTIALLY_SUSPENDED
        : VacationRequestStatus.SUSPENDED;
      request.approved_days = approvedDaysRemaining;
      request.status = finalStatus;
      await queryRunner.manager.save(VacationRequest, request);

      employee = await queryRunner.manager.findOne(Employee, {
        where: { id: request.employee_id },
      });
      suspendedDates = days.map((day) => day.date);
      await queryRunner.commitTransaction();

      await this.notifyEmployee(employee, suspendedDates, dto.reason);
      return {
        message: 'Vacaciones suspendidas correctamente',
        vacation_request_id: request.id,
        suspended_days: suspendedDates,
        restored_days: restoredDays,
        approved_days_remaining: approvedDaysRemaining,
        status: finalStatus,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  findByRequest(vacationRequestId: string) {
    return this.suspensionRepository.find({
      where: { vacation_request_id: vacationRequestId },
      relations: { hrEmployee: true, days: true },
      order: { created_at: 'DESC' },
    });
  }

  async reschedule(
    vacationRequestId: string,
    dto: RescheduleVacationRequestDto,
    hrEmployeeId: string,
  ) {
    if (!hrEmployeeId) throw new ForbiddenException('No fue posible identificar al usuario de RR. HH.');
    const originalDays = [...new Set(dto.original_days.map((day) => day.slice(0, 10)))].sort();
    const newDays = [...new Set(dto.new_days.map((day) => day.slice(0, 10)))].sort();
    if (originalDays.length !== newDays.length) {
      throw new BadRequestException('Debe seleccionar la misma cantidad de días de origen y destino.');
    }
    if (originalDays.every((day, index) => day === newDays[index])) {
      throw new BadRequestException('Las fechas nuevas deben ser diferentes de las actuales.');
    }
    const today = this.todayInTegucigalpa();
    if (newDays.some((day) => day < today)) {
      throw new BadRequestException('Las fechas nuevas no pueden estar en el pasado.');
    }
    if (newDays.some((day) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay()))) {
      throw new BadRequestException('No se pueden programar vacaciones en sábado o domingo.');
    }

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    let employee: Employee | null = null;
    try {
      const request = await runner.manager.findOne(VacationRequest, {
        where: { id: vacationRequestId }, lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw new NotFoundException('Solicitud de vacaciones no encontrada');
      const hrAreaIds = await this.areaManagerService.findAreaIdsByEmployeeAndRole(
        hrEmployeeId, AreaManagerRole.HR,
      );
      if (!hrAreaIds.length && request.hr_employee_id !== hrEmployeeId) {
        throw new ForbiddenException('Solo Recursos Humanos puede correr días de vacaciones.');
      }
      if (
        ![VacationRequestStatus.APPROVED, VacationRequestStatus.PARTIALLY_SUSPENDED].includes(request.status) ||
        request.hr_status !== VacationRequestStatus.APPROVED || !request.is_processed
      ) {
        throw new BadRequestException('Solo se pueden correr días de vacaciones aprobadas y procesadas.');
      }

      const days = await this.dayService.findSuspendibleWithManager(
        request.id, originalDays, today, runner.manager,
      );
      if (days.length !== originalDays.length) {
        throw new BadRequestException('Uno o más días ya pasaron, fueron suspendidos o no pertenecen a la solicitud.');
      }

      const blocked: Array<{ date: string }> = await runner.query(
        `SELECT date::text AS date FROM holidays
         WHERE is_active = true AND date = ANY($1::date[])
         UNION
         SELECT day.date::text FROM government_vacation_days day
         WHERE day."isActive" = true AND day.date = ANY($1::date[])
           AND NOT EXISTS (
             SELECT 1 FROM employee_government_vacation_exclusions exclusion
             WHERE exclusion.government_vacation_day_id = day.id AND exclusion.employee_id = $2
           )`,
        [newDays, request.employee_id],
      );
      if (blocked.length) {
        throw new BadRequestException(`Hay fechas feriadas o no disponibles: ${blocked.map((item) => item.date).join(', ')}`);
      }

      const occupied: Array<{ date: string }> = await runner.query(
        `SELECT DISTINCT day.date::text AS date
         FROM vacation_request_days day
         INNER JOIN vacation_requests request ON request.id = day.vacation_request_id
         WHERE request.employee_id = $1
           AND day.date = ANY($2::date[])
           AND day.counts_as_vacation = true
           AND day.status::text = 'APPROVED'
           AND NOT (day.id = ANY($3::uuid[]))
           AND request.status::text NOT IN ('REJECTED', 'SUSPENDED')`,
        [request.employee_id, newDays, days.map((day) => day.id)],
      );
      if (occupied.length) {
        throw new BadRequestException(`El empleado ya tiene vacaciones en: ${occupied.map((item) => item.date).join(', ')}`);
      }

      const orderedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
      orderedDays.forEach((day, index) => {
        day.date = newDays[index];
        day.note = `Reprogramado desde ${originalDays[index]}. Motivo: ${dto.reason.trim()}`;
      });
      await runner.manager.save(VacationRequestDay, orderedDays);
      await runner.manager.save(VacationRequestReschedule, runner.manager.create(
        VacationRequestReschedule,
        {
          vacation_request_id: request.id,
          hr_employee_id: hrEmployeeId,
          original_days: originalDays,
          new_days: newDays,
          reason: dto.reason.trim(),
        },
      ));

      const activeDays = await runner.manager.find(VacationRequestDay, {
        where: {
          vacation_request_id: request.id,
          status: VacationRequestDayStatus.APPROVED,
          counts_as_vacation: true,
        },
        order: { date: 'ASC' },
      });
      request.start_date = activeDays[0].date;
      request.end_date = activeDays[activeDays.length - 1].date;
      request.approved_days = activeDays.length;
      await runner.manager.save(VacationRequest, request);
      employee = await runner.manager.findOne(Employee, { where: { id: request.employee_id } });
      await runner.commitTransaction();

      await this.notifyReschedule(employee, originalDays, newDays, dto.reason.trim());
      return {
        message: 'Días de vacaciones reprogramados correctamente',
        vacation_request_id: request.id,
        original_days: originalDays,
        new_days: newDays,
      };
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }

  private todayInTegucigalpa() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Tegucigalpa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }

  private async notifyEmployee(employee: Employee | null, days: string[], reason: string) {
    if (!employee) return;
    const name = [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName]
      .filter(Boolean)
      .join(' ');
    const message = `Recursos Humanos suspendió ${days.length} día(s) de sus vacaciones y los devolvió a su saldo.`;
    await Promise.allSettled([
      sendRequestNotification(
        employee.email,
        'Suspensión de vacaciones',
        name || 'Empleado',
        message,
        [`Fechas: ${days.join(', ')}`, `Motivo: ${reason}`],
        'https://sigerh.senasa.gob.hn/vacations/history',
      ),
      this.pushNotifications.sendToEmployee(
        employee.id,
        'Vacaciones suspendidas',
        message,
        '/vacations/history',
      ),
    ]);
  }

  private async notifyReschedule(
    employee: Employee | null,
    originalDays: string[],
    newDays: string[],
    reason: string,
  ) {
    if (!employee) return;
    const name = [employee.firstName, employee.middleName, employee.lastName, employee.secondLastName]
      .filter(Boolean).join(' ');
    const message = `Recursos Humanos reprogramó ${newDays.length} día(s) de sus vacaciones.`;
    await Promise.allSettled([
      sendRequestNotification(
        employee.email, 'Reprogramación de vacaciones', name || 'Empleado', message,
        [`Fechas anteriores: ${originalDays.join(', ')}`, `Fechas nuevas: ${newDays.join(', ')}`, `Motivo: ${reason}`],
        'https://sigerh.senasa.gob.hn/vacations/history',
      ),
      this.pushNotifications.sendToEmployee(
        employee.id, 'Vacaciones reprogramadas', message, '/vacations/history',
      ),
    ]);
  }
}
