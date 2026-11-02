import { Kysely, Transaction } from 'kysely';
import { Database } from '../database/database.types.js';

type TTransaction = Transaction<Database> | Kysely<Database>;
export default TTransaction;
