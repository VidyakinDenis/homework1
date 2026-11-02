import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { Database } from '../database/database.types.js';
import TTransaction from '../shared/TransactionType.js';

@Injectable()
export class AuthRepository {
  constructor(@InjectKysely() private readonly db: Kysely<Database>) {}

  async saveRefreshToken(
    hashedToken: string,
    user_id: number,
    expiresAt: Date,
    trx: TTransaction = this.db,
  ) {
    await trx
      .insertInto('refresh_tokens')
      .values({
        user_id,
        token_hash: hashedToken,
        expires_at: expiresAt,
        revoked_at: null,
      })
      .execute();
  }

  async deleteRefreshToken(hashedToken: string, trx: TTransaction = this.db) {
    return await trx
      .deleteFrom('refresh_tokens')
      .where('token_hash', '=', hashedToken)
      .executeTakeFirst();
  }

  async findRefreshToken(hashedToken: string, trx: TTransaction = this.db) {
    return await trx
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', hashedToken)
      .forUpdate()
      .executeTakeFirst();
  }
}
