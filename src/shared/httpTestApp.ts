import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { KYSELY_MODULE_CONNECTION_TOKEN } from 'nestjs-kysely';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import { vi } from 'vitest';
import appConfig from '../config/app.config.js';
import jwtConfig from '../config/jwt.config.js';
import { AuthController } from '../auth/auth.controller.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { TokensHelper } from '../auth/helpers/tokens-helper.js';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { UserController } from '../user/user.controller.js';
import { UserService } from '../user/user.service.js';
import { UserRepository } from '../user/user.repository.js';
import { PasswordHelper } from '../user/helpers/password-helper.js';
import { createDbMock } from './testFactories.js';

export const jwtCfg = {
  accessSecret: 'access-secret',
  refreshSecret: 'refresh-secret',
  accessExpiresIn: '15m',
  refreshExpiresIn: '30d',
};

export async function createHttpTestApp() {
  const users = {
    getUserById: vi.fn(),
    getUsersByLogin: vi.fn(),
    getFullUserByLogin: vi.fn(),
    MGetFullUserById: vi.fn(),
    isActive: vi.fn(),
    createUser: vi.fn(),
    patchUser: vi.fn(),
    deleteUserById: vi.fn(),
    findUsersByLogin: vi.fn(),
    countUsersByLogin: vi.fn(),
  };
  const authRepo = {
    saveRefreshToken: vi.fn(),
    deleteRefreshToken: vi.fn(),
    findRefreshToken: vi.fn(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ global: true })],
    controllers: [AuthController, UserController],
    providers: [
      AuthService,
      UserService,
      TokensHelper,
      PasswordHelper,
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: UserRepository, useValue: users },
      { provide: AuthRepository, useValue: authRepo },
      { provide: KYSELY_MODULE_CONNECTION_TOKEN(), useValue: createDbMock() },
      { provide: jwtConfig.KEY, useValue: jwtCfg },
      { provide: appConfig.KEY, useValue: { nodeEnv: 'dev', port: 3000 } },
    ],
  }).compile();

  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  await app.init();

  const tokensHelper = moduleRef.get(TokensHelper);

  return {
    app,
    users,
    authRepo,
    tokensHelper,
    jwt: moduleRef.get(JwtService),
    passwords: moduleRef.get(PasswordHelper),
    bearer: async (id: number) => `Bearer ${(await tokensHelper.generateTokens(id)).accessToken}`,
    resetMocks() {
      vi.clearAllMocks();
      users.isActive.mockResolvedValue(true);
    },
  };
}
