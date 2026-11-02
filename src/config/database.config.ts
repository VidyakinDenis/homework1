import { registerAs } from '@nestjs/config';
import { getEnv } from './env.validation.js';

export default registerAs('database', () => {
  const env = getEnv();
  return {
    host: env.PG_HOST,
    port: env.PG_PORT,
    user: env.PG_USER,
    password: env.PG_USER_PASS,
    database: env.PG_DB,
  };
});
