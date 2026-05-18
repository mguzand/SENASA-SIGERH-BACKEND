import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeOrmConfigService } from './typeorm.config';
import { SqlServerConfigService } from 'src/database/sqlserver.config';

@Module({
  imports: [
    // PostgreSQL principal
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),

    // SQL Server secundario
    TypeOrmModule.forRootAsync({
      name: 'sqlserver',
      useClass: SqlServerConfigService,
    }),
  ],
})
export class DatabaseModule {}
