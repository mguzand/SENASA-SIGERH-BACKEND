import { Controller, Get, Param } from '@nestjs/common';
import { VacationContractRuleService } from './vacation-contract-rule.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('vacation-contract-rule')
export class VacationContractRuleController {
  constructor(
    private readonly vacationContractRuleService: VacationContractRuleService,
  ) {}

  @Public()
  @Get(':id')
  getAll(@Param('id') id: string) {
    return this.vacationContractRuleService.getRulesByModality(id);
  }
}
