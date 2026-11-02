import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { Database } from '../database/database.types.js';
import { UserCreate } from './dto/user-create.schema.js';
import { UserPatch } from './dto/user-patch.schema.js';
import { PasswordHelper } from './helpers/password-helper.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UserService {
  constructor(
    @InjectKysely() private readonly db: Kysely<Database>,
    private readonly passwordHelper: PasswordHelper,
    private readonly userRepository: UserRepository,
  ) {}

  async getUserById(id: number) {
    return await this.userRepository.getUserById(id);
  }

  async getAllUsers(page: number, pageSize: number, login?: string) {
    const offset = (page - 1) * pageSize;

    return await this.db.transaction().execute(async (trx) => {
      const users = await this.userRepository.findUsersByLogin(offset, pageSize, login, trx);
      const { total } = await this.userRepository.countUsersByLogin(login, trx);

      return {
        data: users,
        page,
        pageSize,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / pageSize),
      };
    });
  }

  async createUser(dto: UserCreate) {
    const candidate = await this.userRepository.getUsersByLogin(dto.login);
    if (candidate) throw new ConflictException('User with this login already exists');

    const hashedPassword = await this.passwordHelper.hashPassword(dto.password);
    return await this.userRepository.createUser({ ...dto, password: hashedPassword });
  }

  async patchUser(dto: UserPatch, id: number) {
    const payload: UserPatch = { ...dto };
    if (dto.password) {
      payload.password = await this.passwordHelper.hashPassword(dto.password);
    }
    const user = await this.userRepository.patchUser(payload, id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async deleteUserById(id: number) {
    const user = await this.userRepository.deleteUserById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
