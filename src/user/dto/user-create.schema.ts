import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UserCreateSchema = z.object({
  name: z.string().trim().min(1).max(100).describe('Имя'),
  login: z.string().trim().min(3).max(50).describe('Логин'),
  password: z.string().min(6).max(100).describe('Пароль'),
  email: z.email().describe('Email'),
  age: z.number().int().min(0),
  description: z.string().max(1000).describe('Описание'),
});

export type UserCreate = z.infer<typeof UserCreateSchema>;

export class UserCreateDto extends createZodDto(UserCreateSchema) {}
