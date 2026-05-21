import { CommonModule } from './common/common.module';
import { Module } from '@nestjs/common';
import { _ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';

import { APP_GUARD } from '@nestjs/core';
import { ModelsModule } from './modules/models.module';
import { GlobalJwtAuthGuard } from './common/guards/global-jwt.guard';
import { AuthModule } from './common/auth/auth.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { WellKnownController } from './wellknown.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', 'public'),
        serveRoot: '/public',
      },
      {
        rootPath: join(__dirname, '..', 'public', '.well-known'),
        serveRoot: '/.well-known',
        serveStaticOptions: {
          dotfiles: 'allow',
        },
      },
    ),
    CommonModule,
    _ConfigModule,
    ModelsModule,
    DatabaseModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GlobalJwtAuthGuard,
    },
  ],
})
export class AppModule {}
