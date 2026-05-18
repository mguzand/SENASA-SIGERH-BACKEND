// vacation-contract-rule.entity.ts

import { VacationAccrualType } from 'src/common/enums/vacation.enums';
import { EmploymentModality } from 'src/modules/employment_modalities/entities/employment-modality.entity';
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

@Entity('vacation_contract_rules')
export class VacationContractRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EmploymentModality, { nullable: false })
  @JoinColumn({ name: 'employment_modality_id' })
  employmentModality: EmploymentModality;

  @Column({ name: 'employment_modality_id' })
  employmentModalityId: string;

  @Column({
    type: 'enum',
    enum: VacationAccrualType,
    default: VacationAccrualType.YEARLY,
  })
  accrualType: VacationAccrualType;

  @Column({ type: 'int', nullable: true })
  yearNumber: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  days: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  daysPerMonth: number | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  created_at?: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  updated_at?: Date;

  //------------------ Enter date by default when creating insert ------------------//
  @BeforeInsert()
  setDefaultDates() {
    const date = new Date();
    this.created_at = date;
    this.updated_at = date;
  }

  //---------------- Update date by default when creating insert ----------------//
  @BeforeUpdate()
  setDefaultDate() {
    this.updated_at = new Date();
  }
}
