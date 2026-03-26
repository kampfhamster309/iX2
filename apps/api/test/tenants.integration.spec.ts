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
  await prisma.contract.deleteMany();
  await prisma.tenant.deleteMany();
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

async function createAdmin(email = 'admin@test.com', password = 'Admin1234!'): Promise<string> {
  await register(email, password);
  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  return loginAs(email, password);
}

async function createUserWith(
  email: string,
  password: string,
  role: 'MANAGER' | 'TENANT',
): Promise<string> {
  await register(email, password);
  await prisma.user.update({ where: { email }, data: { role } });
  return loginAs(email, password);
}

// ─── GET /tenants ─────────────────────────────────────────────────────────────

describe('GET /tenants', () => {
  it('returns paginated list of tenants', async () => {
    const adminToken = await createAdmin();

    await prisma.tenant.createMany({
      data: [
        { firstName: 'Alice', lastName: 'Müller', email: 'alice@test.com' },
        { firstName: 'Bob', lastName: 'Schmidt', email: 'bob@test.com' },
        { firstName: 'Carol', lastName: 'Weber', email: 'carol@test.com' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/tenants',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(3);
    expect(body.data).toHaveLength(3);
  });

  it('filters by search term (name match)', async () => {
    const adminToken = await createAdmin();

    await prisma.tenant.createMany({
      data: [
        { firstName: 'Alice', lastName: 'Müller' },
        { firstName: 'Bob', lastName: 'Schmidt' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/tenants?search=müller',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ firstName: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0].firstName).toBe('Alice');
  });

  it('filters by search term (email match)', async () => {
    const adminToken = await createAdmin();

    await prisma.tenant.createMany({
      data: [
        { firstName: 'Alice', lastName: 'A', email: 'alice@example.com' },
        { firstName: 'Bob', lastName: 'B', email: 'bob@other.com' },
      ],
    });

    const res = await app.inject({
      method: 'GET',
      url: '/tenants?search=example',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ firstName: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0].firstName).toBe('Alice');
  });
});

// ─── POST /tenants ────────────────────────────────────────────────────────────

describe('POST /tenants', () => {
  it('creates a private tenant with all personal fields', async () => {
    const adminToken = await createAdmin();

    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        firstName: 'Max',
        lastName: 'Mustermann',
        email: 'max@test.com',
        phone: '+49 89 12345',
        dateOfBirth: '1985-06-15',
        address: 'Musterstraße 1, 80333 München',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      firstName: string;
      lastName: string;
      email: string;
      isCompany: boolean;
    };
    expect(body.firstName).toBe('Max');
    expect(body.lastName).toBe('Mustermann');
    expect(body.email).toBe('max@test.com');
    expect(body.isCompany).toBe(false);
  });

  it('creates a company tenant and stores company fields', async () => {
    const adminToken = await createAdmin();

    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        firstName: 'Hans',
        lastName: 'Meier',
        isCompany: true,
        companyName: 'Meier GmbH',
        legalForm: 'GmbH',
        taxId: 'DE123456789',
        commercialRegisterNumber: 'HRB 12345',
        email: 'meier@gmbh.de',
        phone: '+49 89 999',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      isCompany: boolean;
      companyName: string;
      legalForm: string;
      taxId: string;
      commercialRegisterNumber: string;
    };
    expect(body.isCompany).toBe(true);
    expect(body.companyName).toBe('Meier GmbH');
    expect(body.legalForm).toBe('GmbH');
    expect(body.taxId).toBe('DE123456789');
    expect(body.commercialRegisterNumber).toBe('HRB 12345');
  });

  it('returns 400 when isCompany=true but companyName is missing', async () => {
    const adminToken = await createAdmin();

    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        firstName: 'Hans',
        lastName: 'Meier',
        isCompany: true,
        // companyName intentionally omitted
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 403 for TENANT role user', async () => {
    const tenantToken = await createUserWith('tenant@test.com', 'Pass1234!', 'TENANT');

    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { authorization: tenantToken, 'content-type': 'application/json' },
      payload: { firstName: 'Jane', lastName: 'Doe' },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ─── GET /tenants/:id ─────────────────────────────────────────────────────────

describe('GET /tenants/:id', () => {
  it('returns tenant with embedded contracts array', async () => {
    const adminToken = await createAdmin();

    const tenant = await prisma.tenant.create({
      data: { firstName: 'Anna', lastName: 'Bauer', email: 'anna@test.com' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/tenants/${tenant.id}`,
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      id: string;
      firstName: string;
      contracts: unknown[];
    };
    expect(body.id).toBe(tenant.id);
    expect(body.firstName).toBe('Anna');
    expect(Array.isArray(body.contracts)).toBe(true);
  });

  it('returns 404 for non-existent tenant', async () => {
    const adminToken = await createAdmin();

    const res = await app.inject({
      method: 'GET',
      url: '/tenants/nonexistent-id',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── PATCH /tenants/:id ───────────────────────────────────────────────────────

describe('PATCH /tenants/:id', () => {
  it('updates personal fields and persists them', async () => {
    const adminToken = await createAdmin();

    const tenant = await prisma.tenant.create({
      data: { firstName: 'Old', lastName: 'Name', email: 'old@test.com' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/tenants/${tenant.id}`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { firstName: 'New', email: 'new@test.com', phone: '+49 1234' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { firstName: string; email: string; phone: string };
    expect(body.firstName).toBe('New');
    expect(body.email).toBe('new@test.com');
    expect(body.phone).toBe('+49 1234');

    // Verify persisted
    const fetched = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(fetched?.firstName).toBe('New');
    expect(fetched?.email).toBe('new@test.com');
  });

  it('updates company fields (bug-fix verification)', async () => {
    const adminToken = await createAdmin();

    const tenant = await prisma.tenant.create({
      data: {
        firstName: 'Hans',
        lastName: 'Meier',
        isCompany: true,
        companyName: 'Old GmbH',
        legalForm: 'GmbH',
        taxId: 'DE000000000',
      },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/tenants/${tenant.id}`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        companyName: 'New AG',
        legalForm: 'AG',
        taxId: 'DE999999999',
        commercialRegisterNumber: 'HRB 99999',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      companyName: string;
      legalForm: string;
      taxId: string;
      commercialRegisterNumber: string;
    };
    expect(body.companyName).toBe('New AG');
    expect(body.legalForm).toBe('AG');
    expect(body.taxId).toBe('DE999999999');
    expect(body.commercialRegisterNumber).toBe('HRB 99999');

    // Verify persisted via direct DB read
    const fetched = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(fetched?.companyName).toBe('New AG');
    expect(fetched?.taxId).toBe('DE999999999');
  });

  it('returns 403 for TENANT role user', async () => {
    const tenantToken = await createUserWith('tenant@test.com', 'Pass1234!', 'TENANT');
    const tenant = await prisma.tenant.create({
      data: { firstName: 'Test', lastName: 'Tenant' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/tenants/${tenant.id}`,
      headers: { authorization: tenantToken, 'content-type': 'application/json' },
      payload: { firstName: 'Hacked' },
    });

    expect(res.statusCode).toBe(403);
  });
});
