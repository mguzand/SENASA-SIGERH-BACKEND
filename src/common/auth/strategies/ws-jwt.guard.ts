import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class WsJwtGuard extends AuthGuard('jwt') implements CanActivate {
    getRequest(context: ExecutionContext) {
        const client = context.switchToWs().getClient();
        return client.handshake; // Devolver el handshake como request
    }
}