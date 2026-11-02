import { faker } from '@faker-js/faker';
import { vi } from 'vitest';
import type { User } from '../user/dto/user.table.js';

export const makeUserRow = (overrides: Partial<User> = {}): User => ({
  id: faker.number.int({ min: 1, max: 10000 }),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  login: `${faker.internet.username()}_${faker.string.alphanumeric(4)}`,
  password: 'hashed-password',
  age: faker.number.int({ min: 18, max: 80 }),
  description: faker.lorem.sentence(),
  deleted: false,
  ...overrides,
});

export const toPublicUser = ({ password: _password, deleted: _deleted, ...rest }: User) => rest;

export function createDbMock() {
  const db = {
    transaction: vi.fn(),
  };
  db.transaction.mockReturnValue({
    execute: vi.fn((callback: (trx: unknown) => unknown) => callback(db)),
  });
  return db;
}
