import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.test') });

import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { execSync } from 'child_process';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

let app: NestFastifyApplication;
let prisma: PrismaService;

beforeAll(async () => {
  // Apply migrations to test DB
  execSync('pnpm prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  prisma = moduleFixture.get<PrismaService>(PrismaService);
});

beforeEach(async () => {
  // Truncate tables in correct order (FK constraint: refresh_tokens -> users)
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

const TEST_EMAIL = 'test@ix2.local';
const TEST_PASSWORD = 'securepassword123';

async function registerUser(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password },
  });
}

async function loginUser(email = TEST_EMAIL, password = TEST_PASSWORD) {
  return app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
}

describe('POST /auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await registerUser();
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');
  });

  it('returns 409 for duplicate email', async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.statusCode).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'not-an-email', password: 'securepassword123' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for password too short', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: TEST_EMAIL, password: 'short' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('logs in with valid credentials and returns tokens', async () => {
    await registerUser();
    const res = await loginUser();
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
  });

  it('returns 401 for wrong password', async () => {
    await registerUser();
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: TEST_EMAIL, password: 'wrongpassword' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'unknown@ix2.local', password: TEST_PASSWORD },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('GET /auth/me', () => {
  it('returns user profile with valid access token', async () => {
    const regRes = await registerUser();
    const { accessToken } = JSON.parse(regRes.body);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.email).toBe(TEST_EMAIL);
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 without token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and returns new tokens', async () => {
    const regRes = await registerUser();
    const { refreshToken } = JSON.parse(regRes.body);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it('rejects an already-used refresh token (rotation enforcement)', async () => {
    const regRes = await registerUser();
    const { refreshToken } = JSON.parse(regRes.body);

    // Use it once
    await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });

    // Try to use it again
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired or invalid refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid-token-id:invalid-secret' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('logs out and revokes the refresh token', async () => {
    const regRes = await registerUser();
    const { refreshToken } = JSON.parse(regRes.body);

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(200);

    // Subsequent refresh should fail
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(401);
  });
});

describe('GET /auth/admin-only (RBAC)', () => {
  it('allows ADMIN role users', async () => {
    const regRes = await registerUser();
    const { accessToken } = JSON.parse(regRes.body);

    // Promote user to ADMIN via prisma
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { role: 'ADMIN' },
    });

    // Get a new token with the admin role
    const loginRes = await loginUser();
    const adminToken = JSON.parse(loginRes.body).accessToken;

    const res = await app.inject({
      method: 'GET',
      url: '/auth/admin-only',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    // suppress unused variable warning
    void accessToken;
  });

  it('returns 403 for TENANT role users', async () => {
    const regRes = await registerUser();
    const { accessToken } = JSON.parse(regRes.body);

    const res = await app.inject({
      method: 'GET',
      url: '/auth/admin-only',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
