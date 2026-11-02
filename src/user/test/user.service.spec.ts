import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kysely } from 'kysely';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from '../user.service.js';
import { UserRepository } from '../user.repository.js';
import { PasswordHelper } from '../helpers/password-helper.js';
import type { Database } from '../../database/database.types.js';
import { createDbMock, makeUserRow, toPublicUser } from '../../shared/testFactories.js';

const dto = {
  name: 'Denis',
  login: 'denis',
  password: 'secret123',
  email: 'denis@example.com',
  age: 25,
  description: 'about',
};

describe('UserService', () => {
  let db: ReturnType<typeof createDbMock>;
  let repo: Record<keyof UserRepository, ReturnType<typeof vi.fn>>;
  let passwords: { hashPassword: ReturnType<typeof vi.fn> };
  let service: UserService;

  beforeEach(() => {
    db = createDbMock();
    repo = {
      getUserById: vi.fn(),
      findUsersByLogin: vi.fn(),
      countUsersByLogin: vi.fn(),
      getUsersByLogin: vi.fn(),
      createUser: vi.fn(),
      patchUser: vi.fn(),
      deleteUserById: vi.fn(),
    } as unknown as typeof repo;
    passwords = { hashPassword: vi.fn().mockResolvedValue('HASH') };
    service = new UserService(
      db as unknown as Kysely<Database>,
      passwords as unknown as PasswordHelper,
      repo as unknown as UserRepository,
    );
  });

  describe('getAllUsers', () => {
    it('первая страница по умолчанию: offset 0, limit pageSize', async () => {
      repo.findUsersByLogin.mockResolvedValue([]);
      repo.countUsersByLogin.mockResolvedValue({ total: 0 });

      await service.getAllUsers(1, 20);

      expect(repo.findUsersByLogin).toHaveBeenCalledWith(0, 20, undefined, expect.anything());
    });

    it('вторая страница: offset = (page - 1) * pageSize', async () => {
      const users = [toPublicUser(makeUserRow()), toPublicUser(makeUserRow())];
      repo.findUsersByLogin.mockResolvedValue(users);
      repo.countUsersByLogin.mockResolvedValue({ total: '12' });

      const result = await service.getAllUsers(2, 5, 'den');

      expect(repo.findUsersByLogin).toHaveBeenCalledWith(5, 5, 'den', expect.anything());
      expect(repo.countUsersByLogin).toHaveBeenCalledWith('den', expect.anything());
      expect(result).toEqual({ data: users, page: 2, pageSize: 5, total: 12, totalPages: 3 });
    });
  });

  describe('createUser', () => {
    it('хеширует пароль перед записью', async () => {
      repo.getUsersByLogin.mockResolvedValue(undefined);
      repo.createUser.mockResolvedValue({ id: 1 });

      await service.createUser(dto);

      expect(repo.createUser).toHaveBeenCalledWith({ ...dto, password: 'HASH' });
    });

    it('409, если логин занят', async () => {
      repo.getUsersByLogin.mockResolvedValue({ id: 1 });

      await expect(service.createUser(dto)).rejects.toBeInstanceOf(ConflictException);
      expect(repo.createUser).not.toHaveBeenCalled();
    });
  });

  describe('patchUser', () => {
    it('хеширует новый пароль', async () => {
      repo.patchUser.mockResolvedValue({ id: 1 });

      await service.patchUser({ password: 'new-password', name: 'N' }, 1);

      expect(passwords.hashPassword).toHaveBeenCalledWith('new-password');
      expect(repo.patchUser).toHaveBeenCalledWith({ password: 'HASH', name: 'N' }, 1);
    });

    it('без пароля не вызывает хеширование', async () => {
      repo.patchUser.mockResolvedValue({ id: 1 });

      await service.patchUser({ name: 'N' }, 1);

      expect(passwords.hashPassword).not.toHaveBeenCalled();
    });

    it('404, если пользователя нет', async () => {
      repo.patchUser.mockResolvedValue(undefined);

      await expect(service.patchUser({ name: 'N' }, 1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('deleteUserById', () => {
    it('возвращает публичные данные удалённого', async () => {
      const user = toPublicUser(makeUserRow());
      repo.deleteUserById.mockResolvedValue(user);

      await expect(service.deleteUserById(user.id)).resolves.toEqual(user);
    });

    it('404, если пользователь не найден или уже удалён', async () => {
      repo.deleteUserById.mockResolvedValue(undefined);

      await expect(service.deleteUserById(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
