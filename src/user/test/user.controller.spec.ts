import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHttpTestApp } from '../../shared/httpTestApp.js';
import { makeUserRow, toPublicUser } from '../../shared/testFactories.js';

describe('HTTP: /users', () => {
  let ctx: Awaited<ReturnType<typeof createHttpTestApp>>;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createHttpTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(() => ctx.resetMocks());

  describe('GET /users/my', () => {
    it('401 без токена', async () => {
      await request(server()).get('/api/users/my').expect(401);
    });

    it('200: настоящий JWT, профиль без password', async () => {
      ctx.users.getUserById.mockResolvedValue(toPublicUser(makeUserRow({ id: 7 })));

      const res = await request(server())
        .get('/api/users/my')
        .set('Authorization', await ctx.bearer(7))
        .expect(200);

      expect(ctx.users.getUserById).toHaveBeenCalledWith(7);
      expect(res.body).not.toHaveProperty('password');
    });

    it('401 для refresh-токена вместо access', async () => {
      const { refreshToken } = await ctx.tokensHelper.generateTokens(7);

      await request(server())
        .get('/api/users/my')
        .set('Authorization', `Bearer ${refreshToken}`)
        .expect(401);
    });

    it('401, если пользователь удалён, а access-токен ещё жив', async () => {
      ctx.users.isActive.mockResolvedValue(false);

      await request(server())
        .get('/api/users/my')
        .set('Authorization', await ctx.bearer(7))
        .expect(401);
    });

    it('404, если профиль не найден', async () => {
      ctx.users.getUserById.mockResolvedValue(undefined);

      await request(server())
        .get('/api/users/my')
        .set('Authorization', await ctx.bearer(7))
        .expect(404);
    });
  });

  describe('GET /users/:id', () => {
    it('200 без password', async () => {
      ctx.users.getUserById.mockResolvedValue(toPublicUser(makeUserRow({ id: 2 })));

      const res = await request(server())
        .get('/api/users/2')
        .set('Authorization', await ctx.bearer(1))
        .expect(200);

      expect(res.body).not.toHaveProperty('password');
    });

    it('400 для нечислового id', async () => {
      await request(server())
        .get('/api/users/abc')
        .set('Authorization', await ctx.bearer(1))
        .expect(400);
    });
  });

  describe('GET /users (список)', () => {
    it('без query: первая страница из 20 (offset 0, limit 20)', async () => {
      ctx.users.findUsersByLogin.mockResolvedValue([]);
      ctx.users.countUsersByLogin.mockResolvedValue({ total: 0 });

      await request(server())
        .get('/api/users')
        .set('Authorization', await ctx.bearer(1))
        .expect(200);

      expect(ctx.users.findUsersByLogin).toHaveBeenCalledWith(0, 20, undefined, expect.anything());
    });

    it('page=3&pageSize=5&login=den: offset 10, один и тот же поиск для count', async () => {
      ctx.users.findUsersByLogin.mockResolvedValue([]);
      ctx.users.countUsersByLogin.mockResolvedValue({ total: 42 });

      const res = await request(server())
        .get('/api/users?page=3&pageSize=5&login=den')
        .set('Authorization', await ctx.bearer(1))
        .expect(200);

      expect(ctx.users.findUsersByLogin).toHaveBeenCalledWith(10, 5, 'den', expect.anything());
      expect(ctx.users.countUsersByLogin).toHaveBeenCalledWith('den', expect.anything());
      expect(res.body).toMatchObject({ page: 3, pageSize: 5, total: 42, totalPages: 9 });
    });

    it('400 при page=0', async () => {
      await request(server())
        .get('/api/users?page=0')
        .set('Authorization', await ctx.bearer(1))
        .expect(400);
    });
  });

  describe('POST /users/create', () => {
    const body = {
      name: 'D',
      login: 'denis',
      password: 'secret123',
      email: 'd@example.com',
      age: 25,
      description: 'x'.repeat(1000),
    };

    it('201: пароль хешируется, описание 1000 символов допустимо', async () => {
      ctx.users.getUsersByLogin.mockResolvedValue(undefined);
      ctx.users.createUser.mockResolvedValue(toPublicUser(makeUserRow()));

      const res = await request(server()).post('/api/users/create').send(body).expect(201);

      const [saved] = ctx.users.createUser.mock.calls[0];
      expect(saved.password).not.toBe(body.password);
      await expect(ctx.passwords.verifyPasswords(body.password, saved.password)).resolves.toBe(
        true,
      );
      expect(res.body).not.toHaveProperty('password');
    });

    it('поле deleted из тела игнорируется', async () => {
      ctx.users.getUsersByLogin.mockResolvedValue(undefined);
      ctx.users.createUser.mockResolvedValue(toPublicUser(makeUserRow()));

      await request(server())
        .post('/api/users/create')
        .send({ ...body, deleted: true })
        .expect(201);

      expect(ctx.users.createUser.mock.calls[0][0]).not.toHaveProperty('deleted');
    });

    it('409, если логин занят', async () => {
      ctx.users.getUsersByLogin.mockResolvedValue({ id: 1 });

      await request(server()).post('/api/users/create').send(body).expect(409);
    });

    it('409, если БД вернула нарушение unique (23505) при гонке', async () => {
      ctx.users.getUsersByLogin.mockResolvedValue(undefined);
      ctx.users.createUser.mockRejectedValue({
        code: '23505',
        detail: 'Key (email)=(d@example.com) already exists.',
      });

      const res = await request(server()).post('/api/users/create').send(body).expect(409);
      expect(res.body.message).toContain('email');
    });

    it('400 при описании длиннее 1000 символов', async () => {
      await request(server())
        .post('/api/users/create')
        .send({ ...body, description: 'x'.repeat(1001) })
        .expect(400);
    });
  });

  describe('PATCH /users/:id', () => {
    it('401 без токена', async () => {
      await request(server()).patch('/api/users/1').send({ name: 'x' }).expect(401);
    });

    it('403 при изменении чужого профиля', async () => {
      await request(server())
        .patch('/api/users/2')
        .set('Authorization', await ctx.bearer(1))
        .send({ name: 'x' })
        .expect(403);

      expect(ctx.users.patchUser).not.toHaveBeenCalled();
    });

    it('200: пароль хешируется перед записью', async () => {
      ctx.users.patchUser.mockResolvedValue({ id: 1, name: 'x' });

      await request(server())
        .patch('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .send({ password: 'new-secret' })
        .expect(200);

      const [saved] = ctx.users.patchUser.mock.calls[0];
      expect(saved.password).not.toBe('new-secret');
      await expect(ctx.passwords.verifyPasswords('new-secret', saved.password)).resolves.toBe(true);
    });

    it('пароль с пробелами по краям не обрезается', async () => {
      ctx.users.patchUser.mockResolvedValue({ id: 1 });

      await request(server())
        .patch('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .send({ password: ' pass word ' })
        .expect(200);

      const [saved] = ctx.users.patchUser.mock.calls[0];
      await expect(ctx.passwords.verifyPasswords(' pass word ', saved.password)).resolves.toBe(
        true,
      );
    });

    it.each([
      ['пустое тело', {}],
      ['дробный возраст', { age: 20.5 }],
      ['отрицательный возраст', { age: -1 }],
      ['слишком длинное описание', { description: 'x'.repeat(1001) }],
    ])('400: %s', async (_name, body) => {
      await request(server())
        .patch('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .send(body)
        .expect(400);
    });

    it('200: возраст 0 допустим', async () => {
      ctx.users.patchUser.mockResolvedValue({ id: 1 });

      await request(server())
        .patch('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .send({ age: 0 })
        .expect(200);
    });

    it('404, если пользователь пропал или удалён (NoResultError из БД)', async () => {
      const { NoResultError } = await import('kysely');
      ctx.users.patchUser.mockRejectedValue(new NoResultError({} as never));

      await request(server())
        .patch('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('DELETE /users/:id', () => {
    it('401 без токена', async () => {
      await request(server()).delete('/api/users/1').expect(401);
    });

    it('403 при удалении чужого аккаунта', async () => {
      await request(server())
        .delete('/api/users/2')
        .set('Authorization', await ctx.bearer(1))
        .expect(403);

      expect(ctx.users.deleteUserById).not.toHaveBeenCalled();
    });

    it('200: ответ без password', async () => {
      ctx.users.deleteUserById.mockResolvedValue(toPublicUser(makeUserRow({ id: 1 })));

      const res = await request(server())
        .delete('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .expect(200);

      expect(res.body).not.toHaveProperty('password');
    });

    it('404, если аккаунт уже удалён', async () => {
      ctx.users.deleteUserById.mockResolvedValue(undefined);

      await request(server())
        .delete('/api/users/1')
        .set('Authorization', await ctx.bearer(1))
        .expect(404);
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
