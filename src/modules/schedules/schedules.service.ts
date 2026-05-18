import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Schedule } from './entities/schedule.entity';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
  ) {}

  async findAll() {
    const schedules = await this.scheduleRepository.find({
      order: { description: 'ASC' },
    });

    return schedules.map((schedule) => ({
      ...schedule,
      times: `${this.formatTo12Hour(schedule.startTime)} - ${this.formatTo12Hour(schedule.endTime)}`,
    }));
  }

  private formatTo12Hour(time: string) {
    const [hourText, minute] = time.split(':');
    const hour = Number(hourText);
    const period = hour >= 12 ? 'p.m.' : 'a.m.';
    const hour12 = hour % 12 || 12;

    return `${hour12.toString().padStart(2, '0')}:${minute} ${period}`;
  }
}
