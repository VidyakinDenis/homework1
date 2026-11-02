import { Module } from '@nestjs/common';
import { UserController } from './user.controller.js';
import { UserService } from './user.service.js';
import { UserRepository } from './user.repository.js';
import { PasswordHelper } from './helpers/password-helper.js';

@Module({
  controllers: [UserController],
  providers: [UserService, UserRepository, PasswordHelper],
  exports: [UserService, UserRepository, PasswordHelper],
})
export class UserModule {}
