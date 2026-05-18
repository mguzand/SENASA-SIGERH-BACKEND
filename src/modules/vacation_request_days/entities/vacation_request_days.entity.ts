import { VacationRequest } from 'src/modules/vacation-request/entities/vacation-request.entity';
import {
  BeforeInsert,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('vacation_request_days')
export class VacationRequestDay {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  vacation_request_id: string;

  @ManyToOne(() => VacationRequest, (request) => request.days, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vacation_request_id' })
  vacationRequest: VacationRequest;

  @Column({ type: 'date' })
  date: string;

  @Column({ default: true })
  counts_as_vacation: boolean;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  created_at?: Date;

  @BeforeInsert()
  setDefaultDates() {
    const date = new Date();
    this.created_at = date;
  }
}
