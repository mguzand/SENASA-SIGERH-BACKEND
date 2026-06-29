import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

import { SsoClient } from './entities/sso-client.entity';
import { SsoAuthorizationCode } from './entities/sso-authorization-code.entity';
import { AuthorizeSsoDto } from './dto/authorize-sso.dto'; 
import { RolUserService } from '../rol-user/rol-user.service';

import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from 'src/common/auth/auth.service';
import { SsoLoginDto } from './dto/sso-login.dto';
import { SsoTokenDto } from './dto/sso-token.dto';
import { UsersService } from '../users/users.service';



@Injectable()
export class SsoService {
  constructor(
    @InjectRepository(SsoClient)
    private readonly ssoClientRepository: Repository<SsoClient>,

    @InjectRepository(SsoAuthorizationCode)
    private readonly ssoAuthorizationCodeRepository: Repository<SsoAuthorizationCode>,

    private readonly rolesUserService: RolUserService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly _usersService: UsersService

    
  ) {}

  async getUserInfo(authorization?: string) {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no enviado.');
    }

    const token = authorization.replace('Bearer ', '');

    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Token inválido.');
    }

    if (payload.type !== 'sso_access_token') {
      throw new UnauthorizedException('Token SSO inválido.');
    }

    return await this._usersService.findById(payload.sub);
 
  }

  async exchangeCodeForToken(dto: SsoTokenDto) {
    const client = await this.ssoClientRepository.findOne({
      where: {
        clientId: dto.client_id,
        isActive: true,
      },
    });

    if (!client) {
      throw new UnauthorizedException('Cliente SSO inválido.');
    }

    const validSecret = await bcrypt.compare(
      dto.client_secret,
      client.clientSecretHash,
    );

    if (!validSecret) {
      throw new UnauthorizedException('Client secret inválido.');
    }

    const codes = await this.ssoAuthorizationCodeRepository.find({
      where: {
        clientId: client.id,
      },
      relations: {
        user: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: 20,
    });

    let authorizationCode: SsoAuthorizationCode | null = null;

    for (const item of codes) {
      const isValidCode = await bcrypt.compare(dto.code, item.codeHash);

      if (isValidCode) {
        authorizationCode = item;
        break;
      }
    }

    if (!authorizationCode) {
      throw new BadRequestException('Authorization code inválido.');
    }

    if (authorizationCode.usedAt) {
      throw new BadRequestException('Authorization code ya fue utilizado.');
    }

    if (authorizationCode.expiresAt < new Date()) {
      throw new BadRequestException('Authorization code expirado.');
    }

    authorizationCode.usedAt = new Date();
    await this.ssoAuthorizationCodeRepository.save(authorizationCode);

    const payload = {
      sub: authorizationCode.user.id,
      username: authorizationCode.user.username,
      client_id: client.clientId,
      system_id: client.systemId,
      type: 'sso_access_token',
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '8h',
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 28800,
    };
  }


   async loginSso(dto: SsoLoginDto) {
    const client = await this.validateAuthorizeRequest({
      client_id: dto.client_id,
      redirect_uri: dto.redirect_uri,
      response_type: dto.response_type,
      scope: dto.scope,
      state: dto.state,
    });

    const user = await this.authService.validateUser(
      dto.usuario,
      dto.password,
      client.system.id,
    );

    if (!user) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }

    const loginResult = await this.authService.login(user);

    return {
      accessToken: loginResult.token,
      user: loginResult.payload,
    };
  }

  async validateSsoToken(ssoToken: string) {
    try {
        const payload = await this.jwtService.verifyAsync(ssoToken, {
        secret: process.env.JWT_SECRET,
        }); 

        return {
        id: payload.id,
        usuario: payload.username,
        email: payload.email,
        };
    } catch {
        throw new UnauthorizedException('Sesión SSO inválida o expirada.');
    }
  }

  async validateAuthorizeRequest(dto: AuthorizeSsoDto) {
    if (dto.response_type !== 'code') {
      throw new BadRequestException('response_type no válido. Use code.');
    }

    const client = await this.ssoClientRepository.findOne({
      where: {
        clientId: dto.client_id,
        isActive: true,
      },
      relations: {
        system: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Cliente SSO no encontrado o inactivo.');
    }

    if (!client.redirectUris.includes(dto.redirect_uri)) {
      throw new BadRequestException('redirect_uri no autorizado.');
    }

    return client;
  }

  async validateUserAccessToClientSystem(userId: string, client: SsoClient) {
    const hasAccess =
        await this.rolesUserService.userHasAccessToSystem(
        userId,
        client.systemId,
        ); 

    if (!hasAccess) {
        throw new ForbiddenException(
        'El usuario no tiene permisos para acceder a este sistema tttt.',
        );
    }

    return true;
  }

  async createAuthorizationCode(params: {
    userId: string;
    client: SsoClient;
    redirectUri: string;
    scope?: string;
    state?: string;
  }) {
    const plainCode = crypto.randomBytes(32).toString('hex');
    const codeHash = await bcrypt.hash(plainCode, 10);

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.ssoAuthorizationCodeRepository.save({
      codeHash,
      userId: params.userId,
      clientId: params.client.id,
      redirectUri: params.redirectUri,
      scope: params.scope,
      state: params.state,
      expiresAt,
    });

    return plainCode;
  }
}