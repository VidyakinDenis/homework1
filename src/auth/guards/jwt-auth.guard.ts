import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as config from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import jwtConfig from '../../config/jwt.config.js';
import { UserRepository } from '../../user/user.repository.js';
import { AccessTokenPayload, AuthRequest } from '../types/auth-request.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

export const UNAUTHORIZED_MESSAGE = 'user is not authorized';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly userRepository: UserRepository,
    @Inject(jwtConfig.KEY) private readonly jwt: config.ConfigType<typeof jwtConfig>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.jwt.accessSecret,
      });
    } catch {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    if (payload.type !== 'access') throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);

    if (!(await this.userRepository.isActive(payload.id))) {
      throw new UnauthorizedException(UNAUTHORIZED_MESSAGE);
    }

    (req as AuthRequest).user = payload;
    return true;
  }
}
