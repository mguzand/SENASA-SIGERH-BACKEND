import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class GlobalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

// import {
//   CanActivate,
//   ExecutionContext,
//   Injectable,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { ConfigService } from '@nestjs/config';
// import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
// import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

// @Injectable()
// export class JwtAuthGuard implements CanActivate {
//   constructor(
//     private readonly jwtService: JwtService,
//     private readonly configService: ConfigService,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
//     const token = this.extractTokenFromHeader(request);

//     if (!token) {
//       throw new UnauthorizedException('Authentication token was not provided.');
//     }

//     try {
//       const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
//         secret: this.configService.get<string>(
//           'JWT_SECRET',
//           'gamesport-secret-key',
//         ),
//       });

//       request.user = payload;
//     } catch {
//       throw new UnauthorizedException(
//         'Authentication token is invalid or expired.',
//       );
//     }

//     return true;
//   }

//   private extractTokenFromHeader(
//     request: AuthenticatedRequest,
//   ): string | undefined {
//     const [type, token] = request.headers.authorization?.split(' ') ?? [];

//     return type === 'Bearer' ? token : undefined;
//   }
// }
