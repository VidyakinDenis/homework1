import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { PasswordHelper } from '../helpers/password-helper.js';

vi.setConfig({ testTimeout: 20_000 });

describe('PasswordHelper', () => {
  let helper: PasswordHelper;

  beforeEach(() => {
    helper = new PasswordHelper();
  });

  describe('hashPassword', () => {
    it('возвращает bcrypt-хеш, а не исходный пароль, со стоимостью 12', async () => {
      const hash = await helper.hashPassword('password123');

      expect(hash).not.toBe('password123');
      expect(hash).toMatch(/^\$2[aby]\$12\$/);
      expect(bcrypt.getRounds(hash)).toBe(12);
    });

    it('один и тот же пароль даёт разные хеши (соль)', async () => {
      const [a, b] = await Promise.all([
        helper.hashPassword('password123'),
        helper.hashPassword('password123'),
      ]);

      expect(a).not.toBe(b);
    });
  });

  describe('verifyPasswords', () => {
    it('true для правильного пароля', async () => {
      const hash = await helper.hashPassword('password123');

      expect(await helper.verifyPasswords('password123', hash)).toBe(true);
    });

    it('false для неправильного пароля', async () => {
      const hash = await helper.hashPassword('password123');

      expect(await helper.verifyPasswords('wrong-password', hash)).toBe(false);
    });

    it('чувствителен к регистру', async () => {
      const hash = await helper.hashPassword('Password123');

      expect(await helper.verifyPasswords('password123', hash)).toBe(false);
    });

    it('false для пустого пароля', async () => {
      const hash = await helper.hashPassword('password123');

      expect(await helper.verifyPasswords('', hash)).toBe(false);
    });

    it('аргументы в порядке (пароль, хеш): обратный порядок не проходит', async () => {
      const hash = await helper.hashPassword('password123');

      expect(await helper.verifyPasswords(hash, 'password123')).toBe(false);
    });
  });
});
