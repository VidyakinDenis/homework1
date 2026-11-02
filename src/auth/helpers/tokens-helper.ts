import { Inject, Injectable } from '@nestjs/common';
import * as config from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import jwtConfig from '../../config/jwt.config.js';
import type { CookieOptions, Request, Response } from 'express';
import appConfig from '../../config/app.config.js';

type TokenPayload = { id: number; type: 'refresh' | 'access'; jti?: string };
type Expiry = JwtSignOptions['expiresIn'];
export const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class TokensHelper {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY) private readonly jwt: config.ConfigType<typeof jwtConfig>,
    @Inject(appConfig.KEY) private readonly app: config.ConfigType<typeof appConfig>,
  ) {}

  async generateTokens(user_id: number) {
    const accessToken = await this.jwtService.signAsync(
      { id: user_id, type: 'access' },
      {
        secret: this.jwt.accessSecret,
        expiresIn: this.jwt.accessExpiresIn as Expiry,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { id: user_id, type: 'refresh', jti: randomUUID() },
      {
        secret: this.jwt.refreshSecret,
        expiresIn: this.jwt.refreshExpiresIn as Expiry,
      },
    );

    const { exp } = this.jwtService.decode<{ exp: number }>(refreshToken);
    const refreshExpiresAt = new Date(exp * 1000);

    return { accessToken, refreshToken, refreshExpiresAt };
  }

  async getPayloadFromToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verifyAsync<TokenPayload>(token, {
      secret: this.jwt.refreshSecret,
    });
  }

  private get options(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.app.nodeEnv === 'prod',
      sameSite: 'strict',
      path: '/api/auth',
    };
  }

  set(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE, token, { ...this.options, expires: expiresAt });
  }

  clear(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.options);
  }

  read(req: Request): string | undefined {
    return req.cookies?.[REFRESH_COOKIE];
  }

  hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
}
