import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private _authService: AuthService) {
    super({
      usernameField: 'username',
      passwordField: 'password',
      passReqToCallback: true,
    } as any);
  }

  async validate(
    req: Request,
    username: string,
    password: string,
  ): Promise<any> {
    const system = req.body?.system;

    console.log('LOCAL STRATEGY:', {
      username,
      password,
      system,
      body: req.body,
    });

    if (!system) {
      throw new UnauthorizedException(['Debe enviar el sistema.']);
    }

    const user = await this._authService.validateUser(
      username,
      password,
      system,
    );

    if (!user) {
      throw new UnauthorizedException(['Identidad o contraseña incorrectos.']);
    }

    if (!user.hasPermissions) {
      throw new UnauthorizedException([
        'Usuario no tiene permisos para acceder al sistema.',
      ]);
    }

    return user;
  }
}
