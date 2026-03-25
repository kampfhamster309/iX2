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
  // Truncate in correct FK order
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

async function loginAs(email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email, password },
  });
  const body = JSON.parse(res.body) as { accessToken: string };
  return `Bearer ${body.accessToken}`;
}

async function createTestOwner() {
  return prisma.owner.create({
    data: {
      name: 'Test Owner',
      email: 'owner@test.de',
    },
  });
}

async function createAdminUser() {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: 'admin@test.local', password: 'Admin1234!' },
  });
  await prisma.user.update({
    where: { email: 'admin@test.local' },
    data: { role: 'ADMIN' },
  });
  return loginAs('admin@test.local', 'Admin1234!');
}

async function createManagerUser() {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: 'manager@test.local', password: 'Manager1234!' },
  });
  await prisma.user.update({
    where: { email: 'manager@test.local' },
    data: { role: 'MANAGER' },
  });
  return loginAs('manager@test.local', 'Manager1234!');
}

async function createTenantUser() {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: 'tenant@test.local', password: 'Tenant1234!' },
  });
  const { accessToken } = JSON.parse(res.body) as { accessToken: string };
  return `Bearer ${accessToken}`;
}

async function createTestProperty(adminAuth: string, ownerId: string, overrides?: object) {
  const res = await app.inject({
    method: 'POST',
    url: '/properties',
    headers: { Authorization: adminAuth },
    payload: {
      name: 'Test Property',
      address: 'Teststraße 1',
      city: 'München',
      postalCode: '80333',
      country: 'DE',
      ownerId,
      ...overrides,
    },
  });
  return JSON.parse(res.body) as { id: string };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /properties — role-based visibility', () => {
  it('ADMIN sees all properties', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();

    await createTestProperty(adminAuth, owner.id, { name: 'Property A' });
    await createTestProperty(adminAuth, owner.id, { name: 'Property B' });

    const res = await app.inject({
      method: 'GET',
      url: '/properties',
      headers: { Authorization: adminAuth },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(2);
  });

  it('MANAGER sees only assigned properties', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();

    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@test.local' } });

    const prop1 = await createTestProperty(adminAuth, owner.id, { name: 'Managed Prop' });
    await createTestProperty(adminAuth, owner.id, { name: 'Other Prop' });

    // Assign manager to only prop1
    await app.inject({
      method: 'POST',
      url: `/properties/${prop1.id}/managers`,
      headers: { Authorization: adminAuth },
      payload: { userId: managerUser!.id },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/properties',
      headers: { Authorization: managerAuth },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ name: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0].name).toBe('Managed Prop');
  });

  it('TENANT gets empty list', async () => {
    const adminAuth = await createAdminUser();
    const tenantAuth = await createTenantUser();
    const owner = await createTestOwner();

    await createTestProperty(adminAuth, owner.id);

    const res = await app.inject({
      method: 'GET',
      url: '/properties',
      headers: { Authorization: tenantAuth },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(0);
  });
});

describe('POST /properties', () => {
  it('ADMIN can create a property', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();

    const res = await app.inject({
      method: 'POST',
      url: '/properties',
      headers: { Authorization: adminAuth },
      payload: {
        name: 'New Property',
        address: 'Neue Str. 1',
        city: 'Berlin',
        postalCode: '10115',
        ownerId: owner.id,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; name: string };
    expect(body.name).toBe('New Property');
  });

  it('TENANT gets 403 when creating a property', async () => {
    const tenantAuth = await createTenantUser();
    const owner = await createTestOwner();

    const res = await app.inject({
      method: 'POST',
      url: '/properties',
      headers: { Authorization: tenantAuth },
      payload: {
        name: 'Tenant Property',
        address: 'Str. 1',
        city: 'Berlin',
        postalCode: '10115',
        ownerId: owner.id,
      },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /properties/:id', () => {
  it('MANAGER can get an assigned property', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();
    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@test.local' } });

    const prop = await createTestProperty(adminAuth, owner.id);
    await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/managers`,
      headers: { Authorization: adminAuth },
      payload: { userId: managerUser!.id },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/properties/${prop.id}`,
      headers: { Authorization: managerAuth },
    });
    expect(res.statusCode).toBe(200);
  });

  it('MANAGER gets 404 for unassigned property', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();

    const prop = await createTestProperty(adminAuth, owner.id);

    const res = await app.inject({
      method: 'GET',
      url: `/properties/${prop.id}`,
      headers: { Authorization: managerAuth },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PATCH /properties/:id', () => {
  it('MANAGER can update an assigned property', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();
    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@test.local' } });

    const prop = await createTestProperty(adminAuth, owner.id);
    await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/managers`,
      headers: { Authorization: adminAuth },
      payload: { userId: managerUser!.id },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/properties/${prop.id}`,
      headers: { Authorization: managerAuth },
      payload: { name: 'Updated Name' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { name: string };
    expect(body.name).toBe('Updated Name');
  });

  it('MANAGER gets 404 when updating an unassigned property', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();

    const prop = await createTestProperty(adminAuth, owner.id);

    const res = await app.inject({
      method: 'PATCH',
      url: `/properties/${prop.id}`,
      headers: { Authorization: managerAuth },
      payload: { name: 'Updated Name' },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /properties/:id', () => {
  it('ADMIN can delete a property', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const res = await app.inject({
      method: 'DELETE',
      url: `/properties/${prop.id}`,
      headers: { Authorization: adminAuth },
    });
    expect(res.statusCode).toBe(204);
  });

  it('MANAGER gets 403 when deleting a property', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();
    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@test.local' } });

    const prop = await createTestProperty(adminAuth, owner.id);
    await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/managers`,
      headers: { Authorization: adminAuth },
      payload: { userId: managerUser!.id },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/properties/${prop.id}`,
      headers: { Authorization: managerAuth },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /properties/:propertyId/units', () => {
  it('creates a unit and it appears in GET', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const createRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: {
        name: 'Wohnung 1',
        type: 'RESIDENTIAL',
        floor: 1,
        areaSqm: 65.5,
        rooms: 3,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const unit = JSON.parse(createRes.body) as { id: string };

    const listRes = await app.inject({
      method: 'GET',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
    });
    expect(listRes.statusCode).toBe(200);
    const units = JSON.parse(listRes.body) as Array<{ id: string }>;
    expect(units.some((u) => u.id === unit.id)).toBe(true);
  });
});

describe('DELETE /properties/:propertyId/units/:id', () => {
  it('fails with 409 if unit has an active contract', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    // Create a unit
    const unitRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Wohnung 1', type: 'RESIDENTIAL' },
    });
    const unit = JSON.parse(unitRes.body) as { id: string };

    // Create a tenant
    const tenant = await prisma.tenant.create({
      data: { firstName: 'Test', lastName: 'Tenant' },
    });

    // Create an active contract for that unit
    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2024-01-01',
        rentAmount: 800,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    // Try to delete the unit
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/properties/${prop.id}/units/${unit.id}`,
      headers: { Authorization: adminAuth },
    });
    expect(deleteRes.statusCode).toBe(409);
  });
});

describe('POST /contracts', () => {
  it('succeeds for a vacant unit', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const unitRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Wohnung 1', type: 'RESIDENTIAL' },
    });
    const unit = JSON.parse(unitRes.body) as { id: string };

    const tenant = await prisma.tenant.create({
      data: { firstName: 'Max', lastName: 'Müller' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2024-01-01',
        rentAmount: 950,
        depositAmount: 1900,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    expect(res.statusCode).toBe(201);
    const contract = JSON.parse(res.body) as { status: string };
    expect(contract.status).toBe('ACTIVE');
  });

  it('fails with 409 for an already-occupied unit', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const unitRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Wohnung 1', type: 'RESIDENTIAL' },
    });
    const unit = JSON.parse(unitRes.body) as { id: string };

    const tenant1 = await prisma.tenant.create({
      data: { firstName: 'First', lastName: 'Tenant' },
    });
    const tenant2 = await prisma.tenant.create({
      data: { firstName: 'Second', lastName: 'Tenant' },
    });

    // First contract
    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant1.id,
        startDate: '2024-01-01',
        rentAmount: 950,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    // Second contract on same unit
    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant2.id,
        startDate: '2024-06-01',
        rentAmount: 1000,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /contracts/:id/terminate', () => {
  it('sets contract to TERMINATED and unit status to VACANT', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const unitRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Wohnung 1', type: 'RESIDENTIAL' },
    });
    const unit = JSON.parse(unitRes.body) as { id: string };

    const tenant = await prisma.tenant.create({
      data: { firstName: 'Test', lastName: 'Tenant' },
    });

    const contractRes = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2024-01-01',
        rentAmount: 900,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const contract = JSON.parse(contractRes.body) as { id: string };

    const terminateRes = await app.inject({
      method: 'POST',
      url: `/contracts/${contract.id}/terminate`,
      headers: { Authorization: adminAuth },
    });
    expect(terminateRes.statusCode).toBe(201);
    const terminated = JSON.parse(terminateRes.body) as { status: string };
    expect(terminated.status).toBe('TERMINATED');

    // Unit should be VACANT now
    const updatedUnit = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(updatedUnit!.status).toBe('VACANT');
  });
});

describe('GET /contracts — filtering', () => {
  it('can filter by status', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    // Create 2 units and 2 contracts
    const unit1Res = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Unit 1', type: 'RESIDENTIAL' },
    });
    const unit2Res = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Unit 2', type: 'RESIDENTIAL' },
    });
    const unit1 = JSON.parse(unit1Res.body) as { id: string };
    const unit2 = JSON.parse(unit2Res.body) as { id: string };

    const t1 = await prisma.tenant.create({ data: { firstName: 'T1', lastName: 'L1' } });
    const t2 = await prisma.tenant.create({ data: { firstName: 'T2', lastName: 'L2' } });

    const c1Res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit1.id,
        tenantId: t1.id,
        startDate: '2024-01-01',
        rentAmount: 800,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const c2Res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit2.id,
        tenantId: t2.id,
        startDate: '2024-01-01',
        rentAmount: 900,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    const c1 = JSON.parse(c1Res.body) as { id: string };
    void c2Res;

    // Terminate c1
    await app.inject({
      method: 'POST',
      url: `/contracts/${c1.id}/terminate`,
      headers: { Authorization: adminAuth },
    });

    // Filter by ACTIVE
    const activeRes = await app.inject({
      method: 'GET',
      url: '/contracts?status=ACTIVE',
      headers: { Authorization: adminAuth },
    });
    expect(activeRes.statusCode).toBe(200);
    const activeBody = JSON.parse(activeRes.body) as { data: unknown[]; total: number };
    expect(activeBody.total).toBe(1);

    // Filter by TERMINATED
    const terminatedRes = await app.inject({
      method: 'GET',
      url: '/contracts?status=TERMINATED',
      headers: { Authorization: adminAuth },
    });
    expect(terminatedRes.statusCode).toBe(200);
    const terminatedBody = JSON.parse(terminatedRes.body) as { data: unknown[]; total: number };
    expect(terminatedBody.total).toBe(1);
  });

  it('can filter by propertyId', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop1 = await createTestProperty(adminAuth, owner.id, { name: 'Prop 1' });
    const prop2 = await createTestProperty(adminAuth, owner.id, { name: 'Prop 2' });

    const u1Res = await app.inject({
      method: 'POST',
      url: `/properties/${prop1.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'U1', type: 'RESIDENTIAL' },
    });
    const u2Res = await app.inject({
      method: 'POST',
      url: `/properties/${prop2.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'U2', type: 'RESIDENTIAL' },
    });
    const u1 = JSON.parse(u1Res.body) as { id: string };
    const u2 = JSON.parse(u2Res.body) as { id: string };

    const t1 = await prisma.tenant.create({ data: { firstName: 'A', lastName: 'B' } });
    const t2 = await prisma.tenant.create({ data: { firstName: 'C', lastName: 'D' } });

    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: u1.id,
        tenantId: t1.id,
        startDate: '2024-01-01',
        rentAmount: 800,
        type: 'RESIDENTIAL_LEASE',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: u2.id,
        tenantId: t2.id,
        startDate: '2024-01-01',
        rentAmount: 900,
        type: 'RESIDENTIAL_LEASE',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/contracts?propertyId=${prop1.id}`,
      headers: { Authorization: adminAuth },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(1);
  });
});

// ─── TICKET-003a Tests ──────────────────────────────────────────────────────

describe('POST /tenants — company tenant', () => {
  it('creates a company tenant with isCompany: true', async () => {
    const adminAuth = await createAdminUser();

    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { Authorization: adminAuth },
      payload: {
        firstName: 'Test',
        lastName: 'GmbH',
        isCompany: true,
        companyName: 'Test GmbH',
        legalForm: 'GmbH',
      },
    });
    expect(res.statusCode).toBe(201);
    const tenant = JSON.parse(res.body) as { isCompany: boolean; companyName: string };
    expect(tenant.isCompany).toBe(true);
    expect(tenant.companyName).toBe('Test GmbH');
  });

  it('returns 400 when isCompany is true but companyName is missing', async () => {
    const adminAuth = await createAdminUser();

    const res = await app.inject({
      method: 'POST',
      url: '/tenants',
      headers: { Authorization: adminAuth },
      payload: {
        firstName: 'Missing',
        lastName: 'Company',
        isCompany: true,
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('POST /contracts — type field', () => {
  it('returns 400 when type is missing', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const unitRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Wohnung 1', type: 'RESIDENTIAL' },
    });
    const unit = JSON.parse(unitRes.body) as { id: string };
    const tenant = await prisma.tenant.create({ data: { firstName: 'No', lastName: 'Type' } });

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2024-01-01',
        rentAmount: 800,
        // type intentionally omitted
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a contract with type COMMERCIAL_LEASE and returns it in response', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const unitRes = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/units`,
      headers: { Authorization: adminAuth },
      payload: { name: 'Ladenfläche', type: 'COMMERCIAL' },
    });
    const unit = JSON.parse(unitRes.body) as { id: string };
    const tenant = await prisma.tenant.create({
      data: {
        firstName: 'Commercial',
        lastName: 'Tenant',
        isCompany: true,
        companyName: 'Shop GmbH',
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/contracts',
      headers: { Authorization: adminAuth },
      payload: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: '2024-01-01',
        rentAmount: 2000,
        type: 'COMMERCIAL_LEASE',
      },
    });
    expect(res.statusCode).toBe(201);
    const contract = JSON.parse(res.body) as { type: string };
    expect(contract.type).toBe('COMMERCIAL_LEASE');
  });
});

describe('POST /properties/:id/notes', () => {
  it('MANAGER adds a note and gets 201', async () => {
    const adminAuth = await createAdminUser();
    const managerAuth = await createManagerUser();
    const owner = await createTestOwner();
    const managerUser = await prisma.user.findUnique({ where: { email: 'manager@test.local' } });

    const prop = await createTestProperty(adminAuth, owner.id);
    await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/managers`,
      headers: { Authorization: adminAuth },
      payload: { userId: managerUser!.id },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/notes`,
      headers: { Authorization: managerAuth },
      payload: { content: 'Roof inspection completed' },
    });
    expect(res.statusCode).toBe(201);
    const note = JSON.parse(res.body) as { content: string; propertyId: string };
    expect(note.content).toBe('Roof inspection completed');
    expect(note.propertyId).toBe(prop.id);
  });

  it('TENANT gets 403 when adding a note', async () => {
    const adminAuth = await createAdminUser();
    const tenantAuth = await createTenantUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    const res = await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/notes`,
      headers: { Authorization: tenantAuth },
      payload: { content: 'Should not work' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /properties/:id/notes', () => {
  it('returns notes in chronological order', async () => {
    const adminAuth = await createAdminUser();
    const owner = await createTestOwner();
    const prop = await createTestProperty(adminAuth, owner.id);

    await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/notes`,
      headers: { Authorization: adminAuth },
      payload: { content: 'First note' },
    });
    await app.inject({
      method: 'POST',
      url: `/properties/${prop.id}/notes`,
      headers: { Authorization: adminAuth },
      payload: { content: 'Second note' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/properties/${prop.id}/notes`,
      headers: { Authorization: adminAuth },
    });
    expect(res.statusCode).toBe(200);
    const notes = JSON.parse(res.body) as Array<{ content: string }>;
    expect(notes.length).toBe(2);
    expect(notes[0].content).toBe('First note');
    expect(notes[1].content).toBe('Second note');
  });
});
