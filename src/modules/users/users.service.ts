import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { ChangePasswordDto } from 'src/common/auth/dto/change-password.dto';
import { hashPassword } from 'src/common/helpers/password.helper';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private _userRepo: Repository<User>,
  ) {}

  async createUser(
    dto: {
      employeeId: string;
      username: string;
      email: string;
      password: string;
    },
    manager: EntityManager,
  ) {
    const dataQuery = manager.create(User, {
      employeeId: dto.employeeId,
      username: dto.username,
      email: dto.email,
      password: hashPassword(dto.password),
    });

    return await manager.save(User, dataQuery);
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                                 Get the user by user                                 //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async findByUserQuery(username: string) {
    const values = await this._userRepo
      .createQueryBuilder('user')
      .innerJoinAndSelect('user.employee', 'employee')
      .leftJoinAndSelect('employee.schedule', 'schedule')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('jobRecord.modality', 'modality')
      .leftJoinAndSelect('jobRecord.position', 'jobRecordPosition')
      .leftJoinAndSelect(
        'jobRecord.functionalPosition',
        'jobRecordFunctionalPosition',
      )

      .where('user.username = :username or user.email = :email', {
        username,
        email: username,
      })
      .getOne();

    const data = values ? this.formatData(values) : null;
    return data;
  }

  async formatData(items: any) {
    const { employee, ...rest } = items;

    const currentRecord = employee.jobRecords?.find(
      (record) => String(record.status || '').toLowerCase() === 'active',
    );

    return {
      ...rest,
      employee: employee
        ? {
            id: employee.id,
            rtn: employee.rtn,
            names: employee.firstName + ' ' + employee.middleName,
            surname: employee.lastName + ' ' + employee.secondLastName,
            firstName: employee.firstName,
            middleName: employee.middleName,
            lastName: employee.lastName,
            secondLastName: employee.secondLastName,
            email: employee.email,
            phone: employee.phone,
            position: employee.position,
            biometricId: employee.biometric_id,

            modalityName: currentRecord?.modality?.name || null,
            functionalPositionName:
              currentRecord?.functionalPosition?.name || null,
            nominalPositionName: currentRecord?.position?.name || null,
            departmentName: currentRecord?.area?.name || null,
            department_id: currentRecord?.area?.id || null,

            scheduleStartTime: employee.schedule?.startTime || null,
            scheduleEndTime: employee.schedule?.endTime || null,

            salary:
              currentRecord?.salary !== null &&
              currentRecord?.salary !== undefined
                ? Number(currentRecord.salary)
                : null,
          }
        : null,
    };
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                  Update the date the date when making a user login                   //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async setLastLoginNow(username: string) {
    const user = await this.findByUserQuery(username);
    if (user) {
      user.session_date = new Date();
      return await this._userRepo.save(user);
    }
  }

  //↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓↓//
  //                                   Update User Password                               //
  //↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑//
  async updatePassword(data: ChangePasswordDto) {
    const user = await this._userRepo.findOne({
      where: { username: data.username },
    });

    if (!user) throw new BadRequestException(['Usuario no encontrado.']);

    user.password = await hashPassword(data.password);
    return await this._userRepo.save(user);
  }
}
