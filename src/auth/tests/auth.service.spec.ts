import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service.js';
import { AuthRepository } from '../auth.repository.js';
import { TokensHelper } from '../helpers/tokens-helper.js';
import { PasswordHelper } from '../../user/helpers/password-helper.js';
import { UserRepository } from '../../user/user.repository.js';
import type { Database } from '../../database/database.types.js';
import { createDbMock, makeUserRow } from '../../shared/testFactories.js';

const expiresAt = new Date('2030-01-01T00:00:00Z');
const tokens = { accessToken: 'access', refreshToken: 'refresh-NEW', refreshExpiresAt: expiresAt };
const hash = (t: string) => `hash(${t})`;

const dto = {
  name: 'Denis',
  login: 'denis',
  password: 'secret123',
  email: 'denis@example.com',
  age: 25,
  description: 'about',
};

describe('AuthService', () => {
  let db: ReturnType<typeof createDbMock>;
  let users: Record<string, ReturnType<typeof vi.fn>>;
  let authRepo: Record<string, ReturnType<typeof vi.fn>>;
  let tokensHelper: Record<string, ReturnType<typeof vi.fn>>;
  let passwords: Record<string, ReturnType<typeof vi.fn>>;
  let service: AuthService;

  beforeEach(() => {
    db = createDbMock();
    users = {
      getUsersByLogin: vi.fn(),
      getFullUserByLogin: vi.fn(),
      createUser: vi.fn(),
      MGetFullUserById: vi.fn(),
    };
    authRepo = {
      saveRefreshToken: vi.fn(),
      deleteRefreshToken: vi.fn().mockResolvedValue({ numDeletedRows: 1n }),
      findRefreshToken: vi.fn(),
    };
    tokensHelper = {
      generateTokens: vi.fn().mockResolvedValue(tokens),
      getPayloadFromToken: vi.fn(),
      hashToken: vi.fn(hash),
    };
    passwords = {
      hashPassword: vi.fn().mockResolvedValue('HASH'),
      verifyPasswords: vi.fn(),
    };
    service = new AuthService(
      db as unknown as Kysely<Database>,
      passwords as unknown as PasswordHelper,
      tokensHelper as unknown as TokensHelper,
      users as unknown as UserRepository,
      authRepo as unknown as AuthRepository,
    );
  });

  describe('login', () => {
    it('выдаёт токены и сохраняет только хеш refresh', async () => {
      const user = makeUserRow();
      users.getFullUserByLogin.mockResolvedValue(user);
      users.MGetFullUserById.mockResolvedValue(user);
      passwords.verifyPasswords.mockResolvedValue(true);

      await expect(service.login({ login: user.login, password: 'p' })).resolves.toEqual(tokens);

      expect(authRepo.saveRefreshToken).toHaveBeenCalledWith(
        hash('refresh-NEW'),
        user.id,
        expiresAt,
        expect.anything(),
      );
    });

    it('401 для неверного пароля', async () => {
      users.getFullUserByLogin.mockResolvedValue(makeUserRow());
      passwords.verifyPasswords.mockResolvedValue(false);

      await expect(service.login({ login: 'x', password: 'bad' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('401 для удалённого пользователя', async () => {
      users.getFullUserByLogin.mockResolvedValue(makeUserRow({ deleted: true }));

      await expect(service.login({ login: 'x', password: 'p' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(passwords.verifyPasswords).not.toHaveBeenCalled();
    });
  });

  describe('registration', () => {
    it('создаёт пользователя и токен в одной транзакции', async () => {
      const user = makeUserRow();
      users.getUsersByLogin.mockResolvedValue(undefined);
      users.createUser.mockResolvedValue(user);
      users.MGetFullUserById.mockResolvedValue(user);

      await service.registration(dto);

      expect(users.createUser).toHaveBeenCalledWith({ ...dto, password: 'HASH' }, db);
      expect(users.MGetFullUserById).toHaveBeenCalledWith(user.id, db);
      expect(authRepo.saveRefreshToken).toHaveBeenCalledWith(
        hash('refresh-NEW'),
        user.id,
        expiresAt,
        db,
      );
    });

    it('409, если логин занят', async () => {
      users.getUsersByLogin.mockResolvedValue({ id: 1 });

      await expect(service.registration(dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('23505 при гонке превращается в 409', async () => {
      users.getUsersByLogin.mockResolvedValue(undefined);
      users.createUser.mockRejectedValue({ code: '23505' });

      await expect(service.registration(dto)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('refresh', () => {
    const found = { id: 1, user_id: 5 };

    beforeEach(() => {
      authRepo.findRefreshToken.mockResolvedValue(found);
      tokensHelper.getPayloadFromToken.mockResolvedValue({ id: 5, type: 'refresh' });
      users.MGetFullUserById.mockResolvedValue(makeUserRow({ id: 5 }));
    });

    it('хеширует новый токен ровно один раз', async () => {
      await service.refresh('refresh-OLD');

      expect(authRepo.deleteRefreshToken).toHaveBeenCalledWith(hash('refresh-OLD'), db);
      expect(authRepo.saveRefreshToken).toHaveBeenCalledWith(hash('refresh-NEW'), 5, expiresAt, db);
    });

    it('401, если токена нет в БД', async () => {
      authRepo.findRefreshToken.mockResolvedValue(undefined);

      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokensHelper.generateTokens).not.toHaveBeenCalled();
    });

    it('401, если параллельный запрос уже удалил токен (0 строк)', async () => {
      authRepo.deleteRefreshToken.mockResolvedValue({ numDeletedRows: 0n });

      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokensHelper.generateTokens).not.toHaveBeenCalled();
    });

    it('401, если пользователь удалён', async () => {
      users.MGetFullUserById.mockResolvedValue(makeUserRow({ id: 5, deleted: true }));

      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authRepo.saveRefreshToken).not.toHaveBeenCalled();
    });

    it('401, если это не refresh-токен', async () => {
      tokensHelper.getPayloadFromToken.mockResolvedValue({ id: 5, type: 'access' });

      await expect(service.refresh('x')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('удаляет токен по хешу', async () => {
      await service.logout('refresh-OLD');

      expect(authRepo.deleteRefreshToken).toHaveBeenCalledWith(hash('refresh-OLD'));
    });
  });
});
