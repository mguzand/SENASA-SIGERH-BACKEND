import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday } from './entities/holiday.entity';

@Injectable()
export class HolidayService {
  constructor(
    @InjectRepository(Holiday)
    private readonly holidayRepository: Repository<Holiday>,
  ) {}

  findAll() {
    return this.holidayRepository.find({
      where: { is_active: true },
      order: { date: 'ASC', created_at: 'ASC' },
    });
  }

  async create(dto: CreateHolidayDto) {
    await this.ensureNoDuplicate(dto.date, dto.name);

    const holiday = this.holidayRepository.create({
      ...dto,
      description: dto.description?.trim() || null,
    });

    return this.holidayRepository.save(holiday);
  }

  async update(id: number, dto: UpdateHolidayDto) {
    const holiday = await this.findOneOrFail(id);

    const nextDate = dto.date ?? holiday.date;
    const nextName = dto.name ?? holiday.name;

    await this.ensureNoDuplicate(nextDate, nextName, id);

    Object.assign(holiday, {
      ...dto,
      description:
        dto.description !== undefined
          ? dto.description?.trim() || null
          : holiday.description,
    });

    return this.holidayRepository.save(holiday);
  }

  async remove(id: number) {
    const holiday = await this.findOneOrFail(id);

    holiday.is_active = false;
    await this.holidayRepository.save(holiday);
  }

  private async findOneOrFail(id: number) {
    const holiday = await this.holidayRepository.findOne({
      where: { id, is_active: true },
    });

    if (!holiday) {
      throw new NotFoundException('Feriado no encontrado.');
    }

    return holiday;
  }

  private async ensureNoDuplicate(date: string, name: string, excludeId?: number) {
    const query = this.holidayRepository
      .createQueryBuilder('holiday')
      .where('holiday.is_active = :isActive', { isActive: true })
      .andWhere('holiday.date = :date', { date })
      .andWhere('LOWER(holiday.name) = LOWER(:name)', { name });

    if (excludeId) {
      query.andWhere('holiday.id != :excludeId', { excludeId });
    }

    const exists = await query.getOne();

    if (exists) {
      throw new ConflictException('Ya existe un feriado con ese nombre en esa fecha.');
    }
  }
}
