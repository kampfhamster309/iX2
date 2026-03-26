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
  // Respect FK order: contracts → units/tenants → properties → owners → users/refreshTokens
  await prisma.contract.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.propertyManager.deleteMany();
  await prisma.property.deleteMany();
  await prisma.owner.deleteMany();
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

async function seedPropertyAndUnit(adminToken: string) {
  const owner = await prisma.owner.create({ data: { name: 'Test Owner', email: 'o@test.com' } });

  const propRes = await app.inject({
    method: 'POST',
    url: '/properties',
    headers: { authorization: adminToken, 'content-type': 'application/json' },
    payload: {
      name: 'Test Property',
      address: 'Teststraße 1',
      city: 'München',
      postalCode: '80333',
      country: 'DE',
      ownerId: owner.id,
    },
  });
  const property = JSON.parse(propRes.body) as { id: string };

  const unitRes = await app.inject({
    method: 'POST',
    url: `/properties/${property.id}/units`,
    headers: { authorization: adminToken, 'content-type': 'application/json' },
    payload: {
      name: 'Unit 1',
      type: 'RESIDENTIAL',
      floor: 1,
      area: 60,
    },
  });
  const unit = JSON.parse(unitRes.body) as { id: string; status: string };
  return { property, unit };
}

async function seedTenant() {
  return prisma.tenant.create({
    data: { firstName: 'Test', lastName: 'Tenant', email: 'tenant@tenant.com' },
  });
}

// ─── POST /contracts ──────────────────────────────────────────────────────────

describe('POST /contracts', () => {
  it('creates an ACTIVE contract and sets unit to OCCUPIED', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { status: string; type: string };
    expect(body.status).toBe('ACTIVE');
    expect(body.type).toBe('RESIDENTIAL_LEASE');

    // Unit should be OCCUPIED
    const updatedUnit = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(updatedUnit?.status).toBe('OCCUPIED');
  });

  it('returns 409 when unit already has an active contract', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    // Create first contract
    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    // Attempt second contract on same unit
    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-02-01',
        rentAmount: 1300,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('returns 400 when type is missing', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        // type intentionally omitted
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ─── GET /contracts ───────────────────────────────────────────────────────────

describe('GET /contracts', () => {
  it('returns paginated list of contracts', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/contracts',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
  });

  it('filters by status=ACTIVE returns only active contracts', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    // Create one active contract
    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    // Terminate it
    await app.inject({
      method: 'POST',
      url: `/contracts/${contract.id}/terminate`,
      headers: { authorization: adminToken },
    });

    // Create a second property+unit+active contract
    const owner2 = await prisma.owner.create({ data: { name: 'Owner 2', email: 'o2@test.com' } });
    const prop2Res = await app.inject({
      method: 'POST',
      url: '/properties',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        name: 'Property 2',
        address: 'Str. 2',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        ownerId: owner2.id,
      },
    });
    const prop2 = JSON.parse(prop2Res.body) as { id: string };
    const unit2Res = await app.inject({
      method: 'POST',
      url: `/properties/${prop2.id}/units`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { name: 'Unit 2A', type: 'RESIDENTIAL', floor: 1, area: 50 },
    });
    const unit2 = JSON.parse(unit2Res.body) as { id: string };
    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit2.id,
        tenantId: tenant.id,
        startDate: '2026-03-01',
        rentAmount: 900,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/contracts?status=ACTIVE',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ status: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0].status).toBe('ACTIVE');
  });

  it('filters by tenantId returns only that tenant contracts', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant1 = await seedTenant();
    const tenant2 = await prisma.tenant.create({
      data: { firstName: 'Other', lastName: 'Tenant' },
    });

    // Create contract for tenant1
    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant1.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/contracts?tenantId=${tenant2.id}`,
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(0);
  });
});

// ─── GET /contracts/:id ───────────────────────────────────────────────────────

describe('GET /contracts/:id', () => {
  it('returns contract with embedded tenant and unit/property', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    const res = await app.inject({
      method: 'GET',
      url: `/contracts/${contract.id}`,
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      id: string;
      tenant: { firstName: string };
      unit: { id: string; property: object };
    };
    expect(body.id).toBe(contract.id);
    expect(body.tenant.firstName).toBe('Test');
    expect(body.unit).toBeDefined();
    expect(body.unit.property).toBeDefined();
  });

  it('returns 404 for non-existent contract', async () => {
    const adminToken = await createAdmin();

    const res = await app.inject({
      method: 'GET',
      url: '/contracts/nonexistent-id',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ─── PATCH /contracts/:id ─────────────────────────────────────────────────────

describe('PATCH /contracts/:id', () => {
  it('updates rentAmount and notes', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1000,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    const res = await app.inject({
      method: 'PATCH',
      url: `/contracts/${contract.id}`,
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: { rentAmount: 1250, notes: 'Rent increase 2026' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { rentAmount: string; notes: string };
    expect(Number(body.rentAmount)).toBe(1250);
    expect(body.notes).toBe('Rent increase 2026');
  });

  it('returns 403 for TENANT role user', async () => {
    const adminToken = await createAdmin();
    const tenantToken = await createUserWith('tenant@test.com', 'Pass1234!', 'TENANT');
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1000,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    const res = await app.inject({
      method: 'PATCH',
      url: `/contracts/${contract.id}`,
      headers: { authorization: tenantToken, 'content-type': 'application/json' },
      payload: { rentAmount: 1 },
    });

    expect(res.statusCode).toBe(403);
  });
});

// ─── POST /contracts/:id/terminate ────────────────────────────────────────────

describe('POST /contracts/:id/terminate', () => {
  it('sets contract to TERMINATED and unit back to VACANT', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/contracts/${contract.id}/terminate`,
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('TERMINATED');

    // Unit should revert to VACANT
    const updatedUnit = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(updatedUnit?.status).toBe('VACANT');
  });

  it('returns 409 when contract is already terminated', async () => {
    const adminToken = await createAdmin();
    const { unit } = await seedPropertyAndUnit(adminToken);
    const tenant = await seedTenant();

    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { authorization: adminToken, 'content-type': 'application/json' },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2026-01-01',
        rentAmount: 1200,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    // First termination
    await app.inject({
      method: 'POST',
      url: `/contracts/${contract.id}/terminate`,
      headers: { authorization: adminToken },
    });

    // Second termination attempt
    const res = await app.inject({
      method: 'POST',
      url: `/contracts/${contract.id}/terminate`,
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(409);
  });
});
