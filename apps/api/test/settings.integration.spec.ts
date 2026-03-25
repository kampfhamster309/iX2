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
  // Clean settings rows so each test starts fresh
  await prisma.systemConfig.deleteMany();
  await prisma.companyProfile.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginAs(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  const body = JSON.parse(res.body) as { accessToken: string };
  return `Bearer ${body.accessToken}`;
}

async function createUserWithRole(email: string, password: string, role: string): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password },
  });
  await prisma.user.update({
    where: { email },
    data: { role: role as 'ADMIN' | 'ACCOUNTANT' | 'TENANT' | 'MANAGER' | 'MAINTENANCE' },
  });
  return loginAs(email, password);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /settings', () => {
  it('returns default system config and company profile when no rows exist', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');
    const res = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      system: { currency: string; defaultLanguage: string };
      company: { name: string };
    };
    expect(body.system.currency).toBe('EUR');
    expect(body.system.defaultLanguage).toBe('en');
    expect(body.company.name).toBe('');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/settings' });
    expect(res.statusCode).toBe(401);
  });
});

describe('PATCH /settings/system', () => {
  it('updates currency and defaultLanguage', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/system',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { currency: 'USD', defaultLanguage: 'de' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { currency: string; defaultLanguage: string };
    expect(body.currency).toBe('USD');
    expect(body.defaultLanguage).toBe('de');
  });

  it('persists change — subsequent GET reflects updated value', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');

    await app.inject({
      method: 'PATCH',
      url: '/settings/system',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { currency: 'GBP' },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/settings',
      headers: { authorization: token },
    });
    const body = JSON.parse(res.body) as { system: { currency: string } };
    expect(body.system.currency).toBe('GBP');
  });

  it('returns 403 for non-ADMIN users', async () => {
    const token = await createUserWithRole('accountant@test.com', 'Pass1234!', 'ACCOUNTANT');
    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/system',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { currency: 'USD' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 for invalid currency value', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');
    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/system',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { currency: 'INVALID' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('PATCH /settings/company', () => {
  it('updates company name and tax fields', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');

    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/company',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: {
        name: 'Muster Immobilien GmbH',
        legalType: 'GmbH',
        taxId: 'DE123456789',
        vatId: 'DE987654321',
        city: 'München',
        country: 'DE',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      name: string;
      legalType: string;
      taxId: string;
      vatId: string;
    };
    expect(body.name).toBe('Muster Immobilien GmbH');
    expect(body.legalType).toBe('GmbH');
    expect(body.taxId).toBe('DE123456789');
    expect(body.vatId).toBe('DE987654321');
  });

  it('returns 403 for non-ADMIN users', async () => {
    const token = await createUserWithRole('manager@test.com', 'Pass1234!', 'MANAGER');
    const res = await app.inject({
      method: 'PATCH',
      url: '/settings/company',
      headers: { authorization: token, 'content-type': 'application/json' },
      payload: { name: 'Hacker Corp' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /settings/company/logo', () => {
  it('stores logo file and returns updated logoPath', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');

    // Create a minimal 1×1 PNG
    const pngBuffer = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
      'hex',
    );

    const boundary = '----TestBoundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="logo.png"',
      'Content-Type: image/png',
      '',
      pngBuffer.toString('binary'),
      `--${boundary}--`,
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/settings/company/logo',
      headers: {
        authorization: token,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(body, 'binary'),
    });

    expect(res.statusCode).toBe(201);
    const respBody = JSON.parse(res.body) as { logoPath: string | null };
    expect(respBody.logoPath).toBeTruthy();
    expect(respBody.logoPath).toContain('logos');
  });

  it('returns 400 for non-image file types', async () => {
    const token = await createUserWithRole('admin@test.com', 'Pass1234!', 'ADMIN');

    const boundary = '----TestBoundary2';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="doc.pdf"',
      'Content-Type: application/pdf',
      '',
      '%PDF-1.4 fake content',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await app.inject({
      method: 'POST',
      url: '/settings/company/logo',
      headers: {
        authorization: token,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.from(body, 'binary'),
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 403 for non-ADMIN users', async () => {
    const token = await createUserWithRole('tenant@test.com', 'Pass1234!', 'TENANT');
    const res = await app.inject({
      method: 'POST',
      url: '/settings/company/logo',
      headers: { authorization: token },
      payload: '',
    });
    expect(res.statusCode).toBe(403);
  });
});
