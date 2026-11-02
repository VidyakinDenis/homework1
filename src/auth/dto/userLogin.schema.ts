import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { UserIdParamSchema } from '../../user/dto/user-params.schema.js';

export const UserLoginSchema = z.object({
  login: z.string().trim().min(1).max(255).nonempty(),
  password: z.string().min(1).max(255).nonempty(),
});

export type UserLogin = z.infer<typeof UserLoginSchema>;
export class UserLoginDto extends createZodDto(UserLoginSchema) {}
