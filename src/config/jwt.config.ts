import { registerAs } from '@nestjs/config';
import { getEnv } from './env.validation.js';

export default registerAs('jwt', () => {
  const env = getEnv();
  return {
    accessSecret: env.JWT_ACCESS_KEY,
    refreshSecret: env.JWT_REFRESH_KEY,
    accessExpiresIn: env.ACCESS_TTL_DAYS,
    refreshExpiresIn: env.REFRESH_TTL_DAYS,
  };
});
