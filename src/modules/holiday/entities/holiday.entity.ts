import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum HolidayType {
  NACIONAL = 'Nacional',
  INSTITUCIONAL = 'Institucional',
}

@Entity('holidays')
export class Holiday {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'varchar',
    length: 150,
  })
  name: string;

  @Column({
    type: 'date',
  })
  date: string;

  @Column({
    type: 'enum',
    enum: HolidayType,
    default: HolidayType.NACIONAL,
  })
  type: HolidayType;

  @Column({
    type: 'text',
    nullable: true,
  })
  description?: string | null;

  @Column({
    type: 'boolean',
    default: true,
  })
  is_active: boolean;

  @CreateDateColumn({
    type: 'timestamp',
  })
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updated_at: Date;
}
