import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.test') });

import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { execSync } from 'child_process';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as path from 'path';
import * as os from 'os';

let app: NestFastifyApplication;
let prisma: PrismaService;

beforeAll(async () => {
  execSync('pnpm prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });

  const testUploadDir = path.join(os.tmpdir(), 'ix2-test-uploads');
  process.env.UPLOAD_DIR = testUploadDir;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(fastifyStatic, {
    root: testUploadDir,
    prefix: '/uploads/',
    serve: false,
  });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  prisma = moduleFixture.get<PrismaService>(PrismaService);
});

beforeEach(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function register(email: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password },
  });
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  const body = JSON.parse(res.body) as { accessToken: string };
  return `Bearer ${body.accessToken}`;
}

async function createAdmin(email = 'admin@test.com', password = 'Admin1234!') {
  await register(email, password);
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  return loginAs(email, password);
}

async function createUserWith(
  email: string,
  password: string,
  role: 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'MAINTENANCE' | 'TENANT' = 'TENANT',
): Promise<{ token: string; id: string }> {
  await register(email, password);
  const user = await prisma.user.update({ where: { email }, data: { role } });
  const token = await loginAs(email, password);
  return { token, id: user.id };
}

// ─── POST /users ──────────────────────────────────────────────────────────────

describe('POST /users', () => {
  it('ADMIN creates a user with profile fields', async () => {
    const adminToken = await createAdmin();
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        email: 'new@test.com',
        password: 'NewPass1234!',
        role: 'ACCOUNTANT',
        firstName: 'Alice',
        lastName: 'Smith',
        username: 'asmith',
        phone: '+49 89 123',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      email: string;
      role: string;
      firstName: string;
      username: string;
      passwordHash?: string;
    };
    expect(body.email).toBe('new@test.com');
    expect(body.role).toBe('ACCOUNTANT');
    expect(body.firstName).toBe('Alice');
    expect(body.username).toBe('asmith');
    expect(body.passwordHash).toBeUndefined();
  });

  it('returns 409 when email already exists', async () => {
    const adminToken = await createAdmin();
    await register('dup@test.com', 'Pass1234!');

    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { email: 'dup@test.com', password: 'Pass1234!' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 409 when username already taken', async () => {
    const adminToken = await createAdmin();
    await prisma.user.update({ where: { email: 'admin@test.com' }, data: { username: 'taken' } });

    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { email: 'other@test.com', password: 'Pass1234!', username: 'taken' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 403 for non-ADMIN', async () => {
    const { token } = await createUserWith('tenant@test.com', 'Pass1234!', 'TENANT');
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { email: 'x@test.com', password: 'Pass1234!' },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /users ───────────────────────────────────────────────────────────────

describe('GET /users', () => {
  it('ADMIN lists all users with pagination', async () => {
    const adminToken = await createAdmin();
    await register('user2@test.com', 'Pass1234!');
    await register('user3@test.com', 'Pass1234!');

    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: { email: string; passwordHash?: string }[];
      total: number;
    };
    expect(body.total).toBe(3);
    expect(body.data.every((u) => u.passwordHash === undefined)).toBe(true);
  });

  it('returns 403 for non-ADMIN', async () => {
    const { token } = await createUserWith('manager@test.com', 'Pass1234!', 'MANAGER');
    const res = await app.inject({
      method: 'GET',
      url: '/users',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /users/me ────────────────────────────────────────────────────────────

describe('GET /users/me', () => {
  it('returns own profile without passwordHash', async () => {
    const { token } = await createUserWith('me@test.com', 'Pass1234!', 'TENANT');
    const res = await app.inject({
      method: 'GET',
      url: '/users/me',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { email: string; passwordHash?: string };
    expect(body.email).toBe('me@test.com');
    expect(body.passwordHash).toBeUndefined();
  });
});

// ─── PATCH /users/me ──────────────────────────────────────────────────────────

describe('PATCH /users/me', () => {
  it('updates own profile fields', async () => {
    const { token } = await createUserWith('edit@test.com', 'Pass1234!', 'TENANT');
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { firstName: 'Jane', lastName: 'Doe', phone: '+1 555 0100' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { firstName: string; lastName: string };
    expect(body.firstName).toBe('Jane');
    expect(body.lastName).toBe('Doe');
  });

  it('returns 409 when updating to an email already in use', async () => {
    await register('other@test.com', 'Pass1234!');
    const { token } = await createUserWith('edit2@test.com', 'Pass1234!', 'TENANT');

    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { email: 'other@test.com' },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ─── PATCH /users/me/password ─────────────────────────────────────────────────

describe('PATCH /users/me/password', () => {
  it('changes own password with correct current password', async () => {
    const { token } = await createUserWith('pw@test.com', 'OldPass1234!', 'TENANT');
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me/password',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { currentPassword: 'OldPass1234!', newPassword: 'NewPass5678!' },
    });
    expect(res.statusCode).toBe(200);

    // Old password should no longer work
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'pw@test.com', password: 'OldPass1234!' },
    });
    expect(loginRes.statusCode).toBe(401);

    // New password should work
    const loginRes2 = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'pw@test.com', password: 'NewPass5678!' },
    });
    expect(loginRes2.statusCode).toBe(200);
  });

  it('returns 401 when current password is wrong', async () => {
    const { token } = await createUserWith('pw2@test.com', 'Pass1234!', 'TENANT');
    const res = await app.inject({
      method: 'PATCH',
      url: '/users/me/password',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { currentPassword: 'WRONG', newPassword: 'NewPass5678!' },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── PATCH /users/:id/role ────────────────────────────────────────────────────

describe('PATCH /users/:id/role', () => {
  it('ADMIN changes another user role', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('target@test.com', 'Pass1234!', 'TENANT');

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${id}/role`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { role: 'ACCOUNTANT' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { role: string };
    expect(body.role).toBe('ACCOUNTANT');
  });

  it('returns 400 for invalid role value', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('target2@test.com', 'Pass1234!', 'TENANT');

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${id}/role`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { role: 'SUPERUSER' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ─── PATCH /users/:id/password (admin reset) ──────────────────────────────────

describe('PATCH /users/:id/password (admin reset)', () => {
  it('ADMIN resets another user password without old password', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('reset@test.com', 'OldPass1234!', 'TENANT');

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${id}/password`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { password: 'AdminReset99!' },
    });
    expect(res.statusCode).toBe(200);

    // New password works
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'reset@test.com', password: 'AdminReset99!' },
    });
    expect(loginRes.statusCode).toBe(200);
  });
});

// ─── Deactivate / Activate ────────────────────────────────────────────────────

describe('PATCH /users/:id/deactivate and /activate', () => {
  it('deactivated user cannot log in', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('deact@test.com', 'Pass1234!', 'TENANT');

    await app.inject({
      method: 'PATCH',
      url: `/users/${id}/deactivate`,
      headers: { authorization: adminToken },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'deact@test.com', password: 'Pass1234!' },
    });
    expect(loginRes.statusCode).toBe(401);
  });

  it('reactivated user can log in again', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('react@test.com', 'Pass1234!', 'TENANT');

    await app.inject({
      method: 'PATCH',
      url: `/users/${id}/deactivate`,
      headers: { authorization: adminToken },
    });
    await app.inject({
      method: 'PATCH',
      url: `/users/${id}/activate`,
      headers: { authorization: adminToken },
    });

    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'react@test.com', password: 'Pass1234!' },
    });
    expect(loginRes.statusCode).toBe(200);
  });

  it('non-ADMIN cannot deactivate users', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('victim@test.com', 'Pass1234!', 'TENANT');
    const { token: managerToken } = await createUserWith('mgr@test.com', 'Pass1234!', 'MANAGER');

    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${id}/deactivate`,
      headers: { authorization: managerToken },
    });
    expect(res.statusCode).toBe(403);

    // Ensure admin token still works (didn't accidentally use it)
    void adminToken;
  });
});

// ─── GET /users/:id ───────────────────────────────────────────────────────────

describe('GET /users/:id', () => {
  it('ADMIN fetches any user by ID', async () => {
    const adminToken = await createAdmin();
    const { id } = await createUserWith('fetch@test.com', 'Pass1234!', 'TENANT');

    const res = await app.inject({
      method: 'GET',
      url: `/users/${id}`,
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { email: string; passwordHash?: string };
    expect(body.email).toBe('fetch@test.com');
    expect(body.passwordHash).toBeUndefined();
  });

  it('returns 404 for non-existent user', async () => {
    const adminToken = await createAdmin();
    const res = await app.inject({
      method: 'GET',
      url: '/users/nonexistent-id',
      headers: { authorization: adminToken },
    });
    expect(res.statusCode).toBe(404);
  });

  it('non-ADMIN gets 403', async () => {
    const { token } = await createUserWith('nonadmin@test.com', 'Pass1234!', 'ACCOUNTANT');
    const res = await app.inject({
      method: 'GET',
      url: '/users/some-id',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(403);
  });
});
