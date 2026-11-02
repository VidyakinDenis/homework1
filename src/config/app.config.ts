import { registerAs } from '@nestjs/config';
import { getEnv } from './env.validation.js';

export default registerAs('app', () => {
  const env = getEnv();
  return { nodeEnv: env.NODE_ENV, port: env.PORT };
});
