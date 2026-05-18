import { Injectable, NotFoundException } from '@nestjs/common';
import { VacationContractRule } from './entities/vacation-contract-rule.entity';
import { LessThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { VacationAccrualType } from 'src/common/enums/vacation.enums';

@Injectable()
@Injectable()
export class VacationContractRuleService {
  constructor(
    @InjectRepository(VacationContractRule)
    private readonly ruleRepository: Repository<VacationContractRule>,
  ) {}

  async getRulesByModality(modality_id: string) {
    const rules = await this.ruleRepository.find({
      where: {
        employmentModalityId: modality_id,
      },
      order: {
        yearNumber: 'DESC',
      },
    });

    if (rules) {
      return rules;
    }

    throw new NotFoundException(
      `No hay regla de vacaciones configurada para esta modalidad`,
    );
  }

  async getDaysByModalityAndYear(
    employmentModalityId: string,
    yearNumber: number,
  ): Promise<number> {
    const exactRule = await this.ruleRepository.findOne({
      where: {
        employmentModalityId,
        yearNumber,
        isActive: true,
      },
    });

    if (exactRule) {
      return Number(exactRule.days);
    }

    const lastAvailableRule = await this.ruleRepository.findOne({
      where: {
        employmentModalityId,
        yearNumber: LessThanOrEqual(yearNumber),
        isActive: true,
        accrualType: VacationAccrualType.YEARLY,
      },
      order: {
        yearNumber: 'DESC',
      },
    });

    if (lastAvailableRule) {
      return Number(lastAvailableRule.days);
    }

    const monthlyRule = await this.ruleRepository.findOne({
      where: {
        employmentModalityId,
        isActive: true,
        accrualType: VacationAccrualType.MONTHLY,
      },
    });

    if (monthlyRule) {
      return Number(monthlyRule.daysPerMonth || 0) * 12;
    }

    throw new NotFoundException(
      `No hay regla de vacaciones configurada para esta modalidad`,
    );
  }
}
