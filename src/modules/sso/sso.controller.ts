import { Controller, Get, Query, Req, Res, Post, Body } from '@nestjs/common';
import type { Request, Response } from 'express'; 
import { SsoService } from './sso.service';
import { AuthorizeSsoDto } from './dto/authorize-sso.dto';
import { Public } from 'src/common/decorators/public.decorator';
import { SsoLoginDto } from './dto/sso-login.dto';
import { renderLoginPage } from './login/login';
import { SsoTokenDto } from './dto/sso-token.dto';

@Controller('sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  @Public()
  @Post('token')
  async token(@Body() dto: SsoTokenDto) {
    return await this.ssoService.exchangeCodeForToken(dto);
  }

  @Public()
  @Get('userinfo')
  async userinfo(@Req() req: Request) {
    const auth = req.headers.authorization;

    return await this.ssoService.getUserInfo(auth);
  }



  @Public()
  @Get('login-page')
  async loginPage(
    @Query() dto: AuthorizeSsoDto,
    @Res() res: Response,
  ) {
    const html = renderLoginPage(dto);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }



  @Public()
  @Post('login')
  async login(
    @Body() dto: SsoLoginDto,
    @Res() res: Response,
  ) {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3100';

    const authorizeUrl = new URL('/api/sso/authorize', apiUrl);

    authorizeUrl.searchParams.set('client_id', dto.client_id);
    authorizeUrl.searchParams.set('redirect_uri', dto.redirect_uri);
    authorizeUrl.searchParams.set('response_type', dto.response_type);

    if (dto.scope) authorizeUrl.searchParams.set('scope', dto.scope);
    if (dto.state) authorizeUrl.searchParams.set('state', dto.state);

    try {
      const result = await this.ssoService.loginSso(dto);

      res.cookie('sso_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8,
      });

      return res.redirect(authorizeUrl.toString());
    } catch {
      const html = renderLoginPage(dto, {
        error: 'Usuario o contraseña incorrectos.',
      });

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(html);
    }
  }



  @Public()
  @Get('authorize')
  async authorize(
    @Query() dto: AuthorizeSsoDto,
    @Req() req: Request,
    @Res() res: Response,
  ) { 
    const client = await this.ssoService.validateAuthorizeRequest(dto);

    const ssoToken = req.cookies?.sso_token;

    if (!ssoToken) {
      const apiUrl = process.env.API_URL ?? 'http://localhost:3100';
      const loginUrl = new URL('/api/sso/login-page', apiUrl);

      loginUrl.searchParams.set('client_id', dto.client_id);
      loginUrl.searchParams.set('redirect_uri', dto.redirect_uri);
      loginUrl.searchParams.set('response_type', dto.response_type);

      if (dto.scope) loginUrl.searchParams.set('scope', dto.scope);
      if (dto.state) loginUrl.searchParams.set('state', dto.state);

      return res.redirect(loginUrl.toString());
    }

    const user = await this.ssoService.validateSsoToken(ssoToken);
 

    try {
      await this.ssoService.validateUserAccessToClientSystem(user.id, client);
    } catch {
      const redirectUrl = new URL(dto.redirect_uri);

      redirectUrl.searchParams.set('error', 'access_denied');
      redirectUrl.searchParams.set(
        'error_description',
        'El usuario no tiene permisos para acceder a este sistema 123.',
      );

      if (dto.state) {
        redirectUrl.searchParams.set('state', dto.state);
      }

      return res.redirect(redirectUrl.toString());
    }

    const code = await this.ssoService.createAuthorizationCode({
      userId: user.id,
      client,
      redirectUri: dto.redirect_uri,
      scope: dto.scope,
      state: dto.state,
    });

    const redirectUrl = new URL(dto.redirect_uri);
    redirectUrl.searchParams.set('code', code);

    if (dto.state) {
      redirectUrl.searchParams.set('state', dto.state);
    }

    return res.redirect(redirectUrl.toString());
  }
}