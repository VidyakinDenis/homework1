import type { Kysely } from 'kysely';
import { Database } from '../database.types.js';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'text')
    .addColumn('email', 'text', (col) => col.unique())
    .addColumn('password', 'text', (col) => col.notNull())
    .addColumn('login', 'text', (col) => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('age', 'integer')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('users').execute();
}
