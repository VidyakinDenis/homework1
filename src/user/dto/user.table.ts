import { Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface IUserTable {
  id: Generated<number>;
  name: string;
  email: string;
  password: string;
  age: number;
  login: string;
  description: string;
  deleted: Generated<boolean>;
}

export type User = Selectable<IUserTable>;
export type NewUser = Insertable<IUserTable>;
export type UserUpdate = Updateable<IUserTable>;
