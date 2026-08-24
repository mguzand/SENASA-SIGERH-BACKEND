import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { RolUser } from 'src/modules/rol-user/entities/rol-user.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'uuid', name: 'employee_id' })
  employeeId: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ default: false, name: 'must_change_password' })
  mustChangePassword: boolean;

  @Column({ nullable: true, name: 'last_login_at' })
  lastLoginAt: Date;

  @Column({ nullable: true, name: 'password_reset_otp_hash', type: 'text' })
  passwordResetOtpHash?: string | null;

  @Column({ nullable: true, name: 'password_reset_otp_expires_at', type: 'timestamp' })
  passwordResetOtpExpiresAt?: Date | null;

  @Column({ nullable: true, name: 'password_reset_otp_requested_at', type: 'timestamp' })
  passwordResetOtpRequestedAt?: Date | null;

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

  @OneToOne(() => Employee, (employee) => employee.user)
  @JoinColumn({ name: 'employee_id' })
  employee: Employee;

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                              Relacion con la table usuarios                          //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  @OneToMany(() => RolUser, (rolUser) => rolUser.user)
  rolUser: RolUser[];
}
