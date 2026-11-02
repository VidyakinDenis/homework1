import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

@Injectable()
export class PasswordHelper {
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, 12);
  }

  async verifyPasswords(pass1: string, pass2: string): Promise<boolean> {
    return await bcrypt.compare(pass1, pass2);
  }
}
