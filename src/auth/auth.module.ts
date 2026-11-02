import { forwardRef, Module } from '@nestjs/common';
import { UserModule } from '../user/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { TokensHelper } from './helpers/tokens-helper.js';
import { PasswordHelper } from '../user/helpers/password-helper.js';
import { AuthRepository } from './auth.repository.js';

@Module({
  imports: [UserModule, JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, TokensHelper, PasswordHelper, AuthRepository],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
