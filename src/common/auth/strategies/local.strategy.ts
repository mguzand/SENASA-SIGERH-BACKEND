import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private _authService: AuthService) {
    super();
  }

  async validate(usuario: string, password: string): Promise<any> {
    const user = await this._authService.validateUser(usuario, password);

    if (!user) {
      throw new UnauthorizedException(['Identidad o contraseña incorrectos.']);
    }
    return user;
  }
}
