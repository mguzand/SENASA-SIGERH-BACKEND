import { Injectable } from '@nestjs/common';
import { comparePassword } from './helpers/password.helper';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/modules/users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private _userService: UsersService,
    private _jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string) {
    ///////////////////////////////////////////////////////////////////////////////
    ///                  Validate Username in the users table                   ///
    ///////////////////////////////////////////////////////////////////////////////
    let user: any = await this._userService.findByUserQuery(username);

    if (user) {
      if (comparePassword(password, user.password)) {
        await this._userService.setLastLoginNow(user.username);
        const { ...result } = user;
        return result;
      }
    }
    return null;
  }

  async updatePassword(data: ChangePasswordDto) {
    return this._userService.updatePassword(data);
  }

  ///////////////////////////////////////////////////////////////////////////////
  ///               Generar el JWT con la infotmacion del login               ///
  ///////////////////////////////////////////////////////////////////////////////
  async login(user: any) {
    const data = [user];

    const payload = data.map((items) => {
      return {
        username: items.username,
        email: items.email,
        surname: items.surname,
        employees: items.employee,
        biometricId: items.biometricId,

        firstName: items.firstName,
        middleName: items.middleName,
        lastName: items.lastName,
        secondLastName: items.secondLastName,
        department: items.departmentName,
        nominal_position: items.nominalPositionName,
        functional_position: items.functionalPositionName,
        modality: items.modalityName,

        schedule_startTime: items.scheduleStartTime,
        schedule_endTime: items.scheduleEndTime,
        department_id: items.department_id,
      };
    });
    const token = this._jwtService.sign(payload[0]);
    return { token };
  }
}
