import { IUserTable } from '../user/dto/user.table.js';
import { RefreshTokensTable } from '../auth/dto/refresh_tokens.table.js';

export type Database = {
  users: IUserTable;
  refresh_tokens: RefreshTokensTable;
};
