import * as path from 'path';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import { Kysely, PostgresDialect, PostgresDialectConfig } from 'kysely';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { fileURLToPath } from 'node:url';
import { Database } from './database.types.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = ['latest', 'up', 'down'] as const;
type Command = (typeof COMMANDS)[number];

async function migrate(command: Command) {
  const dialectConfig: PostgresDialectConfig = {
    pool: new Pool({
      host: process.env.PG_HOST,
      port: Number(process.env.PG_PORT),
      user: process.env.PG_USER,
      password: process.env.PG_USER_PASS,
      database: process.env.PG_DB,
    }) as unknown as PostgresDialectConfig['pool'],
  };

  const db = new Kysely<Database>({
    dialect: new PostgresDialect(dialectConfig),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(dirname, 'migrations'),
    }),
  });

  try {
    const { error, results } =
      command === 'latest'
        ? await migrator.migrateToLatest()
        : command === 'up'
          ? await migrator.migrateUp()
          : await migrator.migrateDown();

    if (!results?.length && !error) {
      console.log('nothing to migrate');
    }

    results?.forEach((it) => {
      const verb = it.direction === 'Up' ? 'executed' : 'reverted';
      if (it.status === 'Success') {
        console.log(`migration "${it.migrationName}" was ${verb} successfully`);
      } else if (it.status === 'Error') {
        console.error(`failed to execute migration "${it.migrationName}"`);
      } else {
        console.log(`migration "${it.migrationName}" was not executed`);
      }
    });

    if (error) {
      console.error('failed to migrate');
      console.error(error);
      process.exitCode = 1;
    }
  } finally {
    await db.destroy();
  }
}

const command = process.argv[2] as Command | undefined;

if (!command || !COMMANDS.includes(command)) {
  console.error(`Usage: migrate <${COMMANDS.join('|')}>`);
  process.exitCode = 1;
} else {
  migrate(command);
}
