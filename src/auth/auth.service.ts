import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Kysely } from 'kysely';
import { Database } from '../database/database.types.js';
import { UserCreate } from '../user/dto/user-create.schema.js';
import { UserLogin } from './dto/userLogin.schema.js';
import { TokensHelper } from './helpers/tokens-helper.js';
import { PasswordHelper } from '../user/helpers/password-helper.js';
import { UserRepository } from '../user/user.repository.js';
import { AuthRepository } from './auth.repository.js';
import TTransaction from '../shared/TransactionType.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectKysely() private readonly db: Kysely<Database>,
    private readonly passwordHelper: PasswordHelper,
    private readonly tokensHelper: TokensHelper,
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  private isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === '23505';

  async login(userDto: UserLogin) {
    const user = await this.validateUser(userDto);
    const tokens = await this.tokensHelper.generateTokens(user.id);
    await this.saveRefreshToken(tokens.refreshToken, tokens.refreshExpiresAt, user.id);

    return tokens;
  }

  async registration(userDto: UserCreate) {
    const candidate = await this.userRepository.getUsersByLogin(userDto.login);
    if (candidate) {
      throw new ConflictException('User with this login already exists');
    }

    const hashedPassword = await this.passwordHelper.hashPassword(userDto.password);

    try {
      const result = await this.db.transaction().execute(async (trx) => {
        const user = await this.userRepository.createUser(
          { ...userDto, password: hashedPassword },
          trx,
        );

        const tokens = await this.tokensHelper.generateTokens(user.id);
        await this.saveRefreshToken(tokens.refreshToken, tokens.refreshExpiresAt, user.id, trx);

        return { user, tokens };
      });

      return result.tokens;
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('User with this login or email already exists');
      }
      throw e;
    }
  }

  async logout(refreshToken: string) {
    const hashedToken = this.tokensHelper.hashToken(refreshToken);
    const deleted = await this.authRepository.deleteRefreshToken(hashedToken);
  }

  async refresh(refreshToken: string) {
    return await this.db.transaction().execute(async (trx) => {
      const hashedToken = this.tokensHelper.hashToken(refreshToken);

      const found = await this.authRepository.findRefreshToken(hashedToken, trx);
      if (!found) {
        throw new UnauthorizedException('token not found');
      }

      let payload: { id: number; type: string };
      try {
        payload = await this.tokensHelper.getPayloadFromToken(refreshToken);
      } catch {
        throw new UnauthorizedException('Invalid refresh token');
      }
      if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');

      const deleted = await this.authRepository.deleteRefreshToken(hashedToken, trx);
      if (Number(deleted?.numDeletedRows ?? 0) !== 1) {
        throw new UnauthorizedException('token not found');
      }

      const tokens = await this.tokensHelper.generateTokens(payload.id);
      await this.saveRefreshToken(tokens.refreshToken, tokens.refreshExpiresAt, payload.id, trx);

      return tokens;
    });
  }

  private async saveRefreshToken(
    token: string,
    expiresAt: Date,
    userId: number,
    trx: TTransaction = this.db,
  ) {
    const user = await this.userRepository.MGetFullUserById(userId, trx);
    if (!user || user.deleted) {
      throw new UnauthorizedException('User not found or deleted');
    }

    await this.authRepository.saveRefreshToken(
      this.tokensHelper.hashToken(token),
      userId,
      expiresAt,
      trx,
    );
  }

  private async validateUser(userDto: UserLogin) {
    const user = await this.userRepository.getFullUserByLogin(userDto.login);
    if (!user || user.deleted) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    const passwordEqual = await this.passwordHelper.verifyPasswords(
      userDto.password,
      user.password,
    );
    if (!passwordEqual) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    return user;
  }
}
