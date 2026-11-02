import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { UserLoginSchema } from './userLogin.schema.js';

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().trim().nonempty(),
});

export const SuccessTokenSchema = z.object({
  accessToken: z.string().trim().nonempty(),
});

export const TokensPairSchema = z.object({
  refreshToken: z.string().trim().nonempty(),
  accessToken: z.string().trim().nonempty(),
});

export type RefreshTokenSchema = z.infer<typeof RefreshTokenSchema>;
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
export type SuccessTokenSchema = z.infer<typeof SuccessTokenSchema>;
export class SuccessTokenDto extends createZodDto(SuccessTokenSchema) {}
export type TokensPairSchema = z.infer<typeof TokensPairSchema>;
export class TokensPairDto extends createZodDto(TokensPairSchema) {}
