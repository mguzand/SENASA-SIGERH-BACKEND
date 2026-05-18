import { Module } from '@nestjs/common';
import { VacationContractRuleService } from './vacation-contract-rule.service';
import { VacationContractRuleController } from './vacation-contract-rule.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacationContractRule } from './entities/vacation-contract-rule.entity';

@Module({
  controllers: [VacationContractRuleController],
  providers: [VacationContractRuleService],
  imports: [TypeOrmModule.forFeature([VacationContractRule])],
  exports: [VacationContractRuleService],
})
export class VacationContractRuleModule {}
