import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { UserIdParamSchema } from './user-params.schema.js';
import { UserCreateSchema } from './user-create.schema.js';

export const UserPatchSchema = UserCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: 'Нужно передать хотя бы одно поле для изменения',
  },
);

export type UserPatch = z.infer<typeof UserPatchSchema>;
export class UserPatchDto extends createZodDto(UserPatchSchema) {}
