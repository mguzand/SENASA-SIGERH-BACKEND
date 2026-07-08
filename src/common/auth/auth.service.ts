import { BadRequestException, Injectable } from '@nestjs/common';
import { comparePassword } from './helpers/password.helper';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/modules/users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { sendPasswordResetOtp } from '../helpers/send-email.helper';

@Injectable()
export class AuthService {
  constructor(
    private _userService: UsersService,
    private _jwtService: JwtService,
  ) {}

  async resetPassword(usuario: string, new_password: string) {
    return await this._userService.updatePassword({
      password: new_password,
      username: usuario,
    });
  }

  async validateUser(username: string, password: string, system: string) {
    ///////////////////////////////////////////////////////////////////////////////
    ///                  Validate Username in the users table                   ///
    ///////////////////////////////////////////////////////////////////////////////
    let user: any = await this._userService.findByUserQuery(username, system);

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

  async requestPasswordResetOtp(identifier: string) {
    const user = await this._userService.findByUsernameOrEmail(identifier);
    const targetEmail = user?.email || user?.employee?.email;

    if (!targetEmail) {
      return {
        message:
          'Si la cuenta existe, enviaremos un codigo temporal al correo registrado.',
      };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresInMinutes = 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this._userService.savePasswordResetOtp(user.id, code, expiresAt);

    await sendPasswordResetOtp(
      targetEmail,
      'Codigo de recuperacion - Portal del Empleado',
      user.employee?.firstName || user.username,
      code,
      expiresInMinutes,
    );

    return {
      message:
        'Si la cuenta existe, enviaremos un codigo temporal al correo registrado.',
      expiresInMinutes,
    };
  }

  async confirmPasswordResetOtp(
    identifier: string,
    code: string,
    newPassword: string,
  ) {
    const user = await this._userService.validatePasswordResetOtp(
      identifier,
      code,
    );

    if (!user) {
      throw new BadRequestException(['El codigo es invalido o ya vencio.']);
    }

    await this._userService.updatePassword({
      username: user.username,
      password: newPassword,
    });

    return {
      message: 'La contrasena fue restablecida correctamente.',
    };
  }

  ///////////////////////////////////////////////////////////////////////////////
  ///               Generar el JWT con la infotmacion del login               ///
  ///////////////////////////////////////////////////////////////////////////////
  async login(user: any) {
    const data = [user];

    const payload = data.map((items) => {
      return {
        id: items.id,
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
        hasPermissions: items.permissions,
      };
    });
    const token = this._jwtService.sign(payload[0]);
    return { token, payload: payload[0] || null };
  }
}
