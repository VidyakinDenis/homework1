import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHttpTestApp, jwtCfg } from '../../shared/httpTestApp.js';
import { makeUserRow } from '../../shared/testFactories.js';

const registrationBody = {
  name: 'Denis',
  login: 'denis',
  password: 'secret123',
  email: 'denis@example.com',
  age: 25,
  description: 'about',
};

describe('HTTP: /auth', () => {
  let ctx: Awaited<ReturnType<typeof createHttpTestApp>>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createHttpTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(() => ctx.resetMocks());

  const refreshCookieOf = (res: request.Response) =>
    String(res.headers['set-cookie']).match(/refresh_token=([^;]+)/)?.[1];

  describe('POST /auth/login', () => {
    it('200: access в теле, refresh в httpOnly cookie', async () => {
      const password = 'secret123';
      const user = makeUserRow({ id: 3, password: await ctx.passwords.hashPassword(password) });
      ctx.users.getFullUserByLogin.mockResolvedValue(user);
      ctx.users.MGetFullUserById.mockResolvedValue(user);

      const res = await request(server())
        .post('/api/auth/login')
        .send({ login: user.login, password })
        .expect(200);

      expect(res.body).toEqual({ accessToken: expect.any(String) });
      const payload = await ctx.jwt.verifyAsync(res.body.accessToken, {
        secret: jwtCfg.accessSecret,
      });
      expect(payload).toMatchObject({ id: 3, type: 'access' });
      expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=.*HttpOnly/);
      expect(ctx.authRepo.saveRefreshToken.mock.calls[0][0]).toBe(
        ctx.tokensHelper.hashToken(refreshCookieOf(res)!),
      );
    });

    it('пароль с пробелами по краям не обрезается', async () => {
      const password = ' secret123 ';
      const user = makeUserRow({ id: 3, password: await ctx.passwords.hashPassword(password) });
      ctx.users.getFullUserByLogin.mockResolvedValue(user);
      ctx.users.MGetFullUserById.mockResolvedValue(user);

      await request(server())
        .post('/api/auth/login')
        .send({ login: user.login, password })
        .expect(200);
    });

    it('401 для неверного пароля', async () => {
      const user = makeUserRow({ password: await ctx.passwords.hashPassword('right-password') });
      ctx.users.getFullUserByLogin.mockResolvedValue(user);

      await request(server())
        .post('/api/auth/login')
        .send({ login: user.login, password: 'wrong-password' })
        .expect(401);
    });

    it('401 для удалённого пользователя', async () => {
      ctx.users.getFullUserByLogin.mockResolvedValue(
        makeUserRow({ password: await ctx.passwords.hashPassword('secret123'), deleted: true }),
      );

      await request(server())
        .post('/api/auth/login')
        .send({ login: 'denis', password: 'secret123' })
        .expect(401);
    });

    it('400 при пустом теле', async () => {
      await request(server()).post('/api/auth/login').send({}).expect(400);
    });
  });

  describe('POST /auth/registration', () => {
    it('201: описание 1000 символов, поле deleted игнорируется', async () => {
      const user = makeUserRow({ id: 9 });
      ctx.users.getUsersByLogin.mockResolvedValue(undefined);
      ctx.users.createUser.mockResolvedValue(user);
      ctx.users.MGetFullUserById.mockResolvedValue(user);

      const res = await request(server())
        .post('/api/auth/registration')
        .send({ ...registrationBody, description: 'x'.repeat(1000), deleted: true })
        .expect(201);

      expect(res.body).toEqual({ accessToken: expect.any(String) });
      const [created] = ctx.users.createUser.mock.calls[0];
      expect(created).not.toHaveProperty('deleted');
      expect(created.password).not.toBe(registrationBody.password);
    });

    it('409, если логин занят', async () => {
      ctx.users.getUsersByLogin.mockResolvedValue({ id: 1 });

      await request(server()).post('/api/auth/registration').send(registrationBody).expect(409);
    });

    it('409, если БД вернула нарушение unique при гонке', async () => {
      ctx.users.getUsersByLogin.mockResolvedValue(undefined);
      ctx.users.createUser.mockRejectedValue({ code: '23505' });

      await request(server()).post('/api/auth/registration').send(registrationBody).expect(409);
    });

    it('400 для описания длиннее 1000 символов', async () => {
      await request(server())
        .post('/api/auth/registration')
        .send({ ...registrationBody, description: 'x'.repeat(1001) })
        .expect(400);
    });
  });

  describe('POST /auth/refresh', () => {
    it('200 без access-токена: ротация, новый refresh хешируется один раз', async () => {
      const { refreshToken } = await ctx.tokensHelper.generateTokens(3);
      ctx.authRepo.findRefreshToken.mockResolvedValue({ id: 1, user_id: 3 });
      ctx.authRepo.deleteRefreshToken.mockResolvedValue({ numDeletedRows: 1n });
      ctx.users.MGetFullUserById.mockResolvedValue(makeUserRow({ id: 3 }));

      const res = await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(200);

      expect(res.body).toEqual({ accessToken: expect.any(String) });
      expect(ctx.authRepo.deleteRefreshToken.mock.calls[0][0]).toBe(
        ctx.tokensHelper.hashToken(refreshToken),
      );
      expect(ctx.authRepo.saveRefreshToken.mock.calls[0][0]).toBe(
        ctx.tokensHelper.hashToken(refreshCookieOf(res)!),
      );
    });

    it('401 без cookie', async () => {
      await request(server()).post('/api/auth/refresh').expect(401);
    });

    it('401 при проигранной гонке (токен уже удалён)', async () => {
      const { refreshToken } = await ctx.tokensHelper.generateTokens(3);
      ctx.authRepo.findRefreshToken.mockResolvedValue({ id: 1, user_id: 3 });
      ctx.authRepo.deleteRefreshToken.mockResolvedValue({ numDeletedRows: 0n });

      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(401);
    });

    it('401, если пользователь удалён', async () => {
      const { refreshToken } = await ctx.tokensHelper.generateTokens(3);
      ctx.authRepo.findRefreshToken.mockResolvedValue({ id: 1, user_id: 3 });
      ctx.authRepo.deleteRefreshToken.mockResolvedValue({ numDeletedRows: 1n });
      ctx.users.MGetFullUserById.mockResolvedValue(makeUserRow({ id: 3, deleted: true }));

      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${refreshToken}`)
        .expect(401);
    });

    it('401, если вместо refresh передан access-токен', async () => {
      const { accessToken } = await ctx.tokensHelper.generateTokens(3);
      ctx.authRepo.findRefreshToken.mockResolvedValue({ id: 1, user_id: 3 });

      await request(server())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${accessToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('отзывает refresh по хешу и чистит cookie, access не нужен', async () => {
      const { refreshToken } = await ctx.tokensHelper.generateTokens(3);
      ctx.authRepo.deleteRefreshToken.mockResolvedValue({ numDeletedRows: 1n });

      const res = await request(server())
        .post('/api/auth/logout')
        .set('Cookie', `refresh_token=${refreshToken}`);

      expect(res.status).toBeLessThan(300);
      expect(ctx.authRepo.deleteRefreshToken).toHaveBeenCalledWith(
        ctx.tokensHelper.hashToken(refreshToken),
      );
      expect(String(res.headers['set-cookie'])).toMatch(/refresh_token=;/);
    });
  });

  it('единый формат ошибок: { statusCode, error, message }', async () => {
    const res = await request(server()).get('/api/users/my').expect(401);

    expect(res.body).toEqual({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'user is not authorized',
    });
  });
});
