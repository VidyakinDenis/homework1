import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { KyselyModule } from 'nestjs-kysely';
import { validateEnv } from './config/env.validation.js';
import appConfig from './config/app.config.js';
import databaseConfig from './config/database.config.js';
import jwtConfig from './config/jwt.config.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { kyselyFactory } from './config/kysely.factory.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: `.${process.env.NODE_ENV}.env`,
      validate: validateEnv,
      load: [appConfig, databaseConfig, jwtConfig],
    }),
    KyselyModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: kyselyFactory,
    }),
    UserModule,
    AuthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
