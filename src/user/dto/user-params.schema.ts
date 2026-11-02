import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { UserCreateSchema } from './user-create.schema.js';

export const UserIdParamSchema = z.object({
  id: z.coerce.number().int().positive().describe('ID пользователя'),
});

export const UsersListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('Номер страницы'),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).describe('Размер страницы'),
  login: z.string().trim().min(1).optional().describe('Фильтр по логину'),
});

export type UserListQuery = z.infer<typeof UsersListSchema>;
export class UsersListDto extends createZodDto(UsersListSchema) {}
export class UserIdParamsDto extends createZodDto(UserIdParamSchema) {}
