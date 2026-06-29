import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { SsoClient } from './entities/sso-client.entity';
import { SsoAuthorizationCode } from './entities/sso-authorization-code.entity';
import { RolUserModule } from '../rol-user/rol-user.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from 'src/common/auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '8h',
      },
    }),
    AuthModule,
    TypeOrmModule.forFeature([
      SsoClient,
      SsoAuthorizationCode,
    ]),
    RolUserModule,
    UsersModule
  ],
  controllers: [SsoController],
  providers: [SsoService],
  exports: [SsoService],
})
export class SsoModule {}