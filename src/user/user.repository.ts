import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { Database } from '../database/database.types.js';
import { UserPatch } from './dto/user-patch.schema.js';
import { UserCreate } from './dto/user-create.schema.js';
import TTransaction from '../shared/TransactionType.js';

@Injectable()
export class UserRepository {
  constructor(@InjectKysely() private readonly db: Kysely<Database>) {}

  private readonly publicUserFields = [
    'id',
    'name',
    'email',
    'login',
    'description',
    'age',
  ] as const;

  private activeUsers(trx: TTransaction, login?: string) {
    let query = trx.selectFrom('users').where('deleted', '=', false);
    if (login) {
      query = query.where('login', 'ilike', `%${login}%`);
    }
    return query;
  }

  async deleteUserById(id: number, trx: TTransaction = this.db) {
    return await trx
      .updateTable('users')
      .set({ deleted: true })
      .where('id', '=', id)
      .where('deleted', '=', false)
      .returning(this.publicUserFields)
      .executeTakeFirst();
  }

  async getUsersByLogin(login: string, trx: TTransaction = this.db) {
    return await trx
      .selectFrom('users')
      .select(this.publicUserFields)
      .where('login', '=', login)
      .executeTakeFirst();
  }

  async getFullUserByLogin(login: string, trx: TTransaction = this.db) {
    return await trx.selectFrom('users').selectAll().where('login', '=', login).executeTakeFirst();
  }

  async MGetFullUserById(id: number, trx: TTransaction = this.db) {
    return await trx
      .selectFrom('users')
      .selectAll()
      .forShare()
      .where('id', '=', id)
      .executeTakeFirst();
  }

  async isActive(id: number, trx: TTransaction = this.db) {
    const user = await trx
      .selectFrom('users')
      .select('id')
      .where('id', '=', id)
      .where('deleted', '=', false)
      .executeTakeFirst();
    return Boolean(user);
  }

  async patchUser(dto: UserPatch, id: number, trx: TTransaction = this.db) {
    return await trx
      .updateTable('users')
      .set(dto)
      .where('id', '=', id)
      .where('deleted', '=', false)
      .returning(this.publicUserFields)
      .executeTakeFirstOrThrow();
  }

  async createUser(dto: UserCreate, trx: TTransaction = this.db) {
    return await trx
      .insertInto('users')
      .values(dto)
      .returning(this.publicUserFields)
      .executeTakeFirstOrThrow();
  }

  async getUserById(id: number, trx: TTransaction = this.db) {
    return await trx
      .selectFrom('users')
      .select(this.publicUserFields)
      .where('id', '=', id)
      .where('deleted', '=', false)
      .executeTakeFirst();
  }

  async findUsersByLogin(
    offset: number,
    limit: number,
    login?: string,
    trx: TTransaction = this.db,
  ) {
    return await this.activeUsers(trx, login)
      .select(this.publicUserFields)
      .orderBy('id')
      .limit(limit)
      .offset(offset)
      .execute();
  }

  async countUsersByLogin(login?: string, trx: TTransaction = this.db) {
    return await this.activeUsers(trx, login)
      .select((eb) => eb.fn.countAll<number>().as('total'))
      .executeTakeFirstOrThrow();
  }
}
