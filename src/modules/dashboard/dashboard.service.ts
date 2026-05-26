import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/entities/employee.entity';
import { EmployeeDocument } from '../employees/entities/employee-document.entity';
import { EmployeeVacationPeriod } from '../employee-vacation-period/entities/employee-vacation-period.entity';
import { VacationRequest } from '../vacation-request/entities/vacation-request.entity';
import { EmployeeExitPermit } from '../employee-exit-permits/entities/employee-exit-permit.entity';
import { EmployeeIntakeRequest } from '../employee-intake/entities/employee-intake.entity';
import { EmployeeJobRecord } from '../employee-job-record/entities/employee-job-record.entity';
import { VacationPeriodStatus, VacationRequestStatus } from 'src/common/enums/vacation.enums';
import { ExitPermitStatus } from '../employee-exit-permits/enums/exit-permit-status.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    @InjectRepository(EmployeeDocument)
    private readonly employeeDocumentRepository: Repository<EmployeeDocument>,
    @InjectRepository(EmployeeVacationPeriod)
    private readonly employeeVacationPeriodRepository: Repository<EmployeeVacationPeriod>,
    @InjectRepository(VacationRequest)
    private readonly vacationRequestRepository: Repository<VacationRequest>,
    @InjectRepository(EmployeeExitPermit)
    private readonly employeeExitPermitRepository: Repository<EmployeeExitPermit>,
    @InjectRepository(EmployeeIntakeRequest)
    private readonly employeeIntakeRepository: Repository<EmployeeIntakeRequest>,
    @InjectRepository(EmployeeJobRecord)
    private readonly employeeJobRecordRepository: Repository<EmployeeJobRecord>,
  ) {}

  async getOverview() {
    const today = new Date();
    const todayStr = this.toDateOnly(today);
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const plus30 = this.addDays(today, 30);
    const plus45 = this.addDays(today, 45);

    const [
      activeEmployees,
      pendingIntakes,
      pendingVacationHr,
      pendingExitPermitHr,
      birthdaysToday,
      birthdaysMonth,
      documentsExpiring,
      vacationPeriodsExpiring,
      recentHires,
      employeesByStatusRaw,
      departmentsCoveredRaw,
    ] = await Promise.all([
      this.employeeRepository
        .createQueryBuilder('employee')
        .where('UPPER(COALESCE(employee.status, :fallback)) != :inactive', {
          fallback: 'ACTIVE',
          inactive: 'INACTIVE',
        })
        .getCount(),
      this.employeeIntakeRepository
        .createQueryBuilder('request')
        .where('request.status = :status', { status: 'PENDING' })
        .getCount(),
      this.vacationRequestRepository
        .createQueryBuilder('request')
        .where('request.boss_status = :bossApproved', {
          bossApproved: VacationRequestStatus.APPROVED,
        })
        .andWhere('request.hr_status = :hrPending', {
          hrPending: VacationRequestStatus.PENDING,
        })
        .getCount(),
      this.employeeExitPermitRepository
        .createQueryBuilder('permit')
        .where('permit.boss_status = :bossApproved', {
          bossApproved: ExitPermitStatus.APPROVED,
        })
        .andWhere('permit.hr_status = :hrPending', {
          hrPending: ExitPermitStatus.PENDING,
        })
        .getCount(),
      this.employeeRepository
        .createQueryBuilder('employee')
        .leftJoinAndSelect(
          'employee.jobRecords',
          'jobRecord',
          'LOWER(jobRecord.status) = :jobStatus',
          { jobStatus: 'active' },
        )
        .leftJoinAndSelect('jobRecord.area', 'area')
        .where('employee.birth_date IS NOT NULL')
        .andWhere('EXTRACT(MONTH FROM employee.birth_date) = :month', { month })
        .andWhere('EXTRACT(DAY FROM employee.birth_date) = :day', { day })
        .orderBy('employee.firstName', 'ASC')
        .take(8)
        .getMany(),
      this.employeeRepository
        .createQueryBuilder('employee')
        .leftJoinAndSelect(
          'employee.jobRecords',
          'jobRecord',
          'LOWER(jobRecord.status) = :jobStatus',
          { jobStatus: 'active' },
        )
        .leftJoinAndSelect('jobRecord.area', 'area')
        .where('employee.birth_date IS NOT NULL')
        .andWhere('EXTRACT(MONTH FROM employee.birth_date) = :month', { month })
        .addSelect('EXTRACT(DAY FROM employee.birth_date)', 'birth_day_order')
        .orderBy('birth_day_order', 'ASC')
        .addOrderBy('employee.firstName', 'ASC')
        .take(12)
        .getMany(),
      this.employeeDocumentRepository
        .createQueryBuilder('document')
        .leftJoinAndSelect('document.employee', 'employee')
        .leftJoinAndSelect(
          'employee.jobRecords',
          'jobRecord',
          'LOWER(jobRecord.status) = :jobStatus',
          { jobStatus: 'active' },
        )
        .leftJoinAndSelect('jobRecord.area', 'area')
        .where('document.isActive = :isActive', { isActive: true })
        .andWhere('document.expirationDate IS NOT NULL')
        .andWhere('document.expirationDate >= :todayStr', { todayStr })
        .andWhere('document.expirationDate <= :plus30', {
          plus30: this.toDateOnly(plus30),
        })
        .orderBy('document.expirationDate', 'ASC')
        .take(10)
        .getMany(),
      this.employeeVacationPeriodRepository
        .createQueryBuilder('period')
        .leftJoinAndSelect('period.employee', 'employee')
        .leftJoinAndSelect('period.employeeJobRecord', 'jobRecord')
        .leftJoinAndSelect('jobRecord.area', 'area')
        .where('period.status = :status', { status: VacationPeriodStatus.AVAILABLE })
        .andWhere('period.availableDays > 0')
        .andWhere('period.endDate >= :todayStr', { todayStr })
        .andWhere('period.endDate <= :plus45', {
          plus45: this.toDateOnly(plus45),
        })
        .orderBy('period.endDate', 'ASC')
        .take(10)
        .getMany(),
      this.employeeRepository
        .createQueryBuilder('employee')
        .leftJoinAndSelect(
          'employee.jobRecords',
          'jobRecord',
          'LOWER(jobRecord.status) = :jobStatus',
          { jobStatus: 'active' },
        )
        .leftJoinAndSelect('jobRecord.area', 'area')
        .where('employee.entryDate IS NOT NULL')
        .orderBy('employee.entryDate', 'DESC')
        .take(6)
        .getMany(),
      this.employeeRepository
        .createQueryBuilder('employee')
        .select('UPPER(COALESCE(employee.status, :fallback))', 'status')
        .addSelect('COUNT(employee.id)', 'total')
        .setParameter('fallback', 'ACTIVE')
        .groupBy('UPPER(COALESCE(employee.status, :fallback))')
        .getRawMany(),
      this.employeeJobRecordRepository
        .createQueryBuilder('record')
        .select('COUNT(DISTINCT record.area_id)', 'total')
        .where('LOWER(record.status) = :status', { status: 'active' })
        .andWhere('record.area_id IS NOT NULL')
        .getRawOne(),
    ]);

    const birthdayMonthSet = birthdaysMonth.filter((employee) => {
      const birthDate = employee.birth_date ? new Date(employee.birth_date) : null;
      return birthDate?.getMonth() === today.getMonth();
    });

    return {
      hero: {
        date: today.toISOString(),
        message:
          birthdaysToday.length > 0
            ? `Hoy celebramos ${birthdaysToday.length} cumpleaños en SENASA`
            : 'Todo el pulso de RRHH en un solo lugar',
      },
      stats: {
        activeEmployees,
        departmentsCovered: Number(departmentsCoveredRaw?.total || 0),
        pendingVacationHr,
        pendingExitPermitHr,
        pendingIntakes,
        birthdaysToday: birthdaysToday.length,
        birthdaysMonth: birthdayMonthSet.length,
        documentsExpiring: documentsExpiring.length,
        vacationPeriodsExpiring: vacationPeriodsExpiring.length,
      },
      birthdays: {
        today: birthdaysToday.map((employee) => this.mapEmployeeBirthday(employee)),
        month: birthdayMonthSet.map((employee) => this.mapEmployeeBirthday(employee)),
      },
      alerts: {
        documentsExpiring: documentsExpiring.map((document) => ({
          id: document.id,
          employeeId: document.employeeId,
          employeeName: this.getEmployeeFullName(document.employee),
          employeeCode: this.getEmployeeCode(document.employee),
          departmentName:
            document.employee?.jobRecords?.find((record) => String(record.status).toLowerCase() === 'active')?.area?.name ||
            'Sin departamento',
          documentType: document.documentType,
          expirationDate: document.expirationDate,
          originalName: document.originalName,
          daysRemaining: this.diffInDays(today, new Date(document.expirationDate as Date)),
        })),
        vacationPeriodsExpiring: vacationPeriodsExpiring.map((period) => ({
          id: period.id,
          employeeId: period.employeeId,
          employeeName: this.getEmployeeFullName(period.employee),
          employeeCode: this.getEmployeeCode(period.employee),
          departmentName: period.employeeJobRecord?.area?.name || 'Sin departamento',
          periodNumber: period.periodNumber,
          endDate: period.endDate,
          availableDays: Number(period.availableDays || 0),
          daysRemaining: this.diffInDays(today, new Date(period.endDate)),
        })),
      },
      pulse: {
        recentHires: recentHires.map((employee) => ({
          id: employee.id,
          employeeName: this.getEmployeeFullName(employee),
          employeeCode: this.getEmployeeCode(employee),
          departmentName:
            employee.jobRecords?.find((record) => String(record.status).toLowerCase() === 'active')?.area?.name ||
            'Sin departamento',
          entryDate: employee.entryDate,
        })),
        employeesByStatus: employeesByStatusRaw.map((item) => ({
          status: item.status,
          total: Number(item.total || 0),
        })),
      },
    };
  }

  private mapEmployeeBirthday(employee: Employee) {
    const activeRecord = employee.jobRecords?.find(
      (record) => String(record.status).toLowerCase() === 'active',
    );

    return {
      id: employee.id,
      employeeName: this.getEmployeeFullName(employee),
      employeeCode: this.getEmployeeCode(employee),
      departmentName: activeRecord?.area?.name || 'Sin departamento',
      birthDate: employee.birth_date,
    };
  }

  private getEmployeeFullName(employee: Employee | null | undefined) {
    return [
      employee?.firstName,
      employee?.middleName,
      employee?.lastName,
      employee?.secondLastName,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private getEmployeeCode(employee: Employee | null | undefined) {
    if (!employee) return 'EMP-0000';

    return employee.biometric_id
      ? `EMP-${String(employee.biometric_id).padStart(4, '0')}`
      : `EMP-${employee.id.slice(0, 4).toUpperCase()}`;
  }

  private toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private diffInDays(from: Date, to: Date) {
    const ms = to.setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }
}
