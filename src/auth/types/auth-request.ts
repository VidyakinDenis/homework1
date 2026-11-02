import type { Request } from 'express';

export type AccessTokenPayload = { id: number; type: 'access' };
export type RefreshTokenPayload = { id: number; type: 'refresh'; jti?: string };

export type AuthRequest = Request & { user: AccessTokenPayload };
