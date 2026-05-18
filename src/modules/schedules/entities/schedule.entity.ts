import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';

@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'hora_entrada', type: 'time' })
  startTime: string;

  @Column({ name: 'hora_salida', type: 'time' })
  endTime: string;

  @Column({ name: 'desc_horario' })
  description: string;

  @OneToMany(() => Employee, (employee) => employee.schedule)
  employees: Employee[];
}
