import { ConfigType } from '@nestjs/config';
import { PostgresDialect, PostgresDialectConfig } from 'kysely';
import { Pool } from 'pg';
import databaseConfig from '../config/database.config.js';

export const kyselyFactory = (db: ConfigType<typeof databaseConfig>) => ({
  dialect: new PostgresDialect({
    pool: new Pool({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
    }) as unknown as PostgresDialectConfig['pool'],
  }),
});
