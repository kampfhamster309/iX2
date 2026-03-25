import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.test') });

import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { execSync } from 'child_process';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountType, ContractType } from '@prisma/client';

let app: NestFastifyApplication;
let prisma: PrismaService;

// IDs of seeded accounts (populated in beforeAll)
let bankAccountId: string;
let securityDepositsPayableAccountId: string;
let maintenanceAccountId: string;

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

  // Seed chart of accounts
  const chartOfAccounts = [
    {
      code: '1000',
      name: 'Bank / Cash',
      nameDe: 'Bank / Kasse',
      type: AccountType.ASSET,
      isSystem: true,
    },
    {
      code: '1100',
      name: 'Rent Receivable',
      nameDe: 'Mietforderungen',
      type: AccountType.ASSET,
      isSystem: true,
    },
    {
      code: '2000',
      name: 'Security Deposits Payable',
      nameDe: 'Kautionsverbindlichkeiten',
      type: AccountType.LIABILITY,
      isSystem: true,
    },
    {
      code: '2200',
      name: 'Accounts Payable',
      nameDe: 'Verbindlichkeiten aus Lieferungen und Leistungen',
      type: AccountType.LIABILITY,
      isSystem: true,
    },
    {
      code: '3000',
      name: "Owner's Equity",
      nameDe: 'Eigenkapital',
      type: AccountType.EQUITY,
      isSystem: true,
    },
    {
      code: '4000',
      name: 'Rental Income',
      nameDe: 'Mieteinnahmen',
      type: AccountType.INCOME,
      isSystem: true,
    },
    {
      code: '6000',
      name: 'Maintenance & Repairs',
      nameDe: 'Instandhaltung und Reparaturen',
      type: AccountType.EXPENSE,
      isSystem: true,
    },
  ];

  for (const account of chartOfAccounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  const bankAccount = await prisma.account.findUnique({ where: { code: '1000' } });
  const sdpAccount = await prisma.account.findUnique({ where: { code: '2000' } });
  const maintenanceAccount = await prisma.account.findUnique({ where: { code: '6000' } });

  bankAccountId = bankAccount!.id;
  securityDepositsPayableAccountId = sdpAccount!.id;
  maintenanceAccountId = maintenanceAccount!.id;
});

beforeEach(async () => {
  // Truncate in correct FK order (child tables first)
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.deposit_deductions CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.deposit_refunds CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.security_deposits CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.payables CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.expenses CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.journal_lines CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.journal_entries CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.payments CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE accounting.invoices CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE public.contracts CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE public.units CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE public.properties CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE public.owners CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE public.users CASCADE');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE public.refresh_tokens CASCADE');
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

interface TestSetup {
  adminToken: string;
  contractId: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
}

async function createTestSetup(): Promise<TestSetup> {
  // Create admin user
  const adminToken = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');

  // Create owner
  const owner = await prisma.owner.create({
    data: { name: 'Test Owner', email: 'owner@test.local' },
  });

  // Create property
  const property = await prisma.property.create({
    data: {
      name: 'Test Property',
      address: 'Test Street 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      ownerId: owner.id,
    },
  });

  // Create unit
  const unit = await prisma.unit.create({
    data: {
      name: 'Unit 101',
      type: 'RESIDENTIAL',
      propertyId: property.id,
    },
  });

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'tenant@test.local',
    },
  });

  // Create contract
  const contract = await prisma.contract.create({
    data: {
      unitId: unit.id,
      tenantId: tenant.id,
      startDate: new Date('2026-01-01'),
      rentAmount: 1200,
      depositAmount: 2400,
      status: 'ACTIVE',
      type: ContractType.RESIDENTIAL_LEASE,
    },
  });

  return {
    adminToken,
    contractId: contract.id,
    propertyId: property.id,
    unitId: unit.id,
    tenantId: tenant.id,
  };
}

async function getAccountBalance(
  token: string,
  accountId: string,
): Promise<{ totalDebit: number; totalCredit: number; balance: number }> {
  const res = await app.inject({
    method: 'GET',
    url: `/accounting/accounts/${accountId}/balance`,
    headers: { authorization: token },
  });
  return JSON.parse(res.body) as { totalDebit: number; totalCredit: number; balance: number };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /accounting/deposits (record deposit)', () => {
  it('records deposit: 201, Bank debit = amount, Security Deposits Payable credit = amount, status = HELD', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: {
        contractId,
        propertyId,
        amount: 2400,
        receivedDate: '2026-01-15',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; status: string; amount: string };
    expect(body.status).toBe('HELD');
    expect(parseFloat(body.amount)).toBe(2400);

    // Verify journal entries
    const bankBalance = await getAccountBalance(adminToken, bankAccountId);
    expect(bankBalance.totalDebit).toBe(2400);

    const sdpBalance = await getAccountBalance(adminToken, securityDepositsPayableAccountId);
    expect(sdpBalance.totalCredit).toBe(2400);
  });
});

describe('POST /accounting/deposits (duplicate deposit)', () => {
  it('returns 409 Conflict for duplicate deposit on same contract', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    // First deposit
    await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: {
        contractId,
        propertyId,
        amount: 2400,
        receivedDate: '2026-01-15',
      },
    });

    // Second deposit for same contract
    const res = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: {
        contractId,
        propertyId,
        amount: 2400,
        receivedDate: '2026-01-15',
      },
    });

    expect(res.statusCode).toBe(409);
  });
});

describe('POST /accounting/deposits/:id/deductions (add deduction)', () => {
  it('adds deduction: 201, status = PARTIALLY_RETURNED, journal entry posted', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    // Record deposit
    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 2400, receivedDate: '2026-01-15' },
    });
    expect(depositRes.statusCode).toBe(201);
    const deposit = JSON.parse(depositRes.body) as { id: string };

    // Add deduction
    const deductRes = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: {
        amount: 300,
        reason: 'Cleaning fee',
        accountId: maintenanceAccountId,
      },
    });

    expect(deductRes.statusCode).toBe(201);
    const body = JSON.parse(deductRes.body) as {
      status: string;
      deductions: Array<{ amount: string }>;
    };
    expect(body.status).toBe('PARTIALLY_RETURNED');
    expect(body.deductions).toHaveLength(1);
    expect(parseFloat(body.deductions[0].amount)).toBe(300);

    // Verify journal: Security Deposits Payable debited, expense account credited
    const sdpBalance = await getAccountBalance(adminToken, securityDepositsPayableAccountId);
    expect(sdpBalance.totalDebit).toBe(300);
    expect(sdpBalance.totalCredit).toBe(2400);

    const maintenanceBalance = await getAccountBalance(adminToken, maintenanceAccountId);
    expect(maintenanceBalance.totalCredit).toBe(300);
  });

  it('returns 400 when deduction exceeds remaining balance', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 1000, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: { amount: 1500, reason: 'Too much', accountId: maintenanceAccountId },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('exceeds remaining');
  });
});

describe('POST /accounting/deposits/:id/refunds (add refund)', () => {
  it('adds refund: 201, status = PARTIALLY_RETURNED, journal entry posted', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 2400, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    const refundRes = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 1200, refundDate: '2026-03-15', reference: 'REF-001' },
    });

    expect(refundRes.statusCode).toBe(201);
    const body = JSON.parse(refundRes.body) as {
      status: string;
      refunds: Array<{ amount: string }>;
    };
    expect(body.status).toBe('PARTIALLY_RETURNED');
    expect(body.refunds).toHaveLength(1);
    expect(parseFloat(body.refunds[0].amount)).toBe(1200);

    // Verify journal: Security Deposits Payable debited, bank credited
    const sdpBalance = await getAccountBalance(adminToken, securityDepositsPayableAccountId);
    expect(sdpBalance.totalDebit).toBe(1200);

    const bankBalance = await getAccountBalance(adminToken, bankAccountId);
    expect(bankBalance.totalCredit).toBe(1200);
  });
});

describe('Full deduction equals deposit amount', () => {
  it('full deduction sets status = FULLY_RETURNED', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 1000, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: { amount: 1000, reason: 'Full forfeiture', accountId: maintenanceAccountId },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('FULLY_RETURNED');
  });
});

describe('Full refund equals deposit amount', () => {
  it('full refund sets status = FULLY_RETURNED', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 800, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 800, refundDate: '2026-03-20' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('FULLY_RETURNED');
  });
});

describe('Deduction after FULLY_RETURNED', () => {
  it('returns 400 when adding deduction to a FULLY_RETURNED deposit', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 500, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    // Fully refund
    await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 500, refundDate: '2026-03-20' },
    });

    // Try deduction after fully returned
    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: { amount: 100, reason: 'Should fail', accountId: maintenanceAccountId },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('Refund after FULLY_RETURNED', () => {
  it('returns 400 when adding refund to a FULLY_RETURNED deposit', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 500, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    // Fully deduct
    await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: { amount: 500, reason: 'Full deduction', accountId: maintenanceAccountId },
    });

    // Try refund after fully returned
    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 100, refundDate: '2026-03-20' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('Partial deduction + partial refund totalling full amount', () => {
  it('sets status = FULLY_RETURNED when combined total equals deposit', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 1000, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    // Partial deduction
    await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: { amount: 400, reason: 'Partial deduction', accountId: maintenanceAccountId },
    });

    // Partial refund that completes the total
    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 600, refundDate: '2026-03-20' },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { status: string };
    expect(body.status).toBe('FULLY_RETURNED');
  });
});

describe('Partial deduction + refund exceeding remaining', () => {
  it('returns 400 when refund exceeds remaining after deduction', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 1000, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    // Partial deduction of 400
    await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/deductions`,
      headers: { authorization: adminToken },
      payload: { amount: 400, reason: 'Deduction', accountId: maintenanceAccountId },
    });

    // Try refund exceeding remaining (600 left, requesting 700)
    const res = await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 700, refundDate: '2026-03-20' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('exceeds remaining');
  });
});

describe('GET /accounting/deposits?status=HELD', () => {
  it('returns only HELD deposits when filtered by status', async () => {
    const { adminToken, contractId, propertyId } = await createTestSetup();

    // Create a deposit (HELD status)
    const depositRes = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: { contractId, propertyId, amount: 1000, receivedDate: '2026-01-15' },
    });
    const deposit = JSON.parse(depositRes.body) as { id: string };

    // Partially refund it (PARTIALLY_RETURNED)
    // First, create a second contract for a second deposit
    const property = await prisma.property.findFirst();
    const unit2 = await prisma.unit.create({
      data: { name: 'Unit 102', type: 'RESIDENTIAL', propertyId: property!.id },
    });
    const tenant2 = await prisma.tenant.create({
      data: { firstName: 'Jane', lastName: 'Smith' },
    });
    const contract2 = await prisma.contract.create({
      data: {
        unitId: unit2.id,
        tenantId: tenant2.id,
        startDate: new Date('2026-01-01'),
        rentAmount: 800,
        status: 'ACTIVE',
        type: ContractType.RESIDENTIAL_LEASE,
      },
    });

    // Create second deposit
    const deposit2Res = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: adminToken },
      payload: {
        contractId: contract2.id,
        propertyId: property!.id,
        amount: 800,
        receivedDate: '2026-01-15',
      },
    });
    const deposit2 = JSON.parse(deposit2Res.body) as { id: string };

    // Partially refund deposit2 -> PARTIALLY_RETURNED
    await app.inject({
      method: 'POST',
      url: `/accounting/deposits/${deposit2.id}/refunds`,
      headers: { authorization: adminToken },
      payload: { amount: 400, refundDate: '2026-03-15' },
    });

    // Filter by HELD
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/deposits?status=HELD',
      headers: { authorization: adminToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ id: string; status: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0].id).toBe(deposit.id);
    expect(body.data[0].status).toBe('HELD');
  });
});

describe('RBAC — non-ACCOUNTANT cannot record deposit', () => {
  it('TENANT token gets 403 on POST /accounting/deposits', async () => {
    const { contractId, propertyId } = await createTestSetup();
    const tenantToken = await createUserWithRole('tenant2@test.local', 'Tenant1234!', 'TENANT');

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/deposits',
      headers: { authorization: tenantToken },
      payload: {
        contractId,
        propertyId,
        amount: 2400,
        receivedDate: '2026-01-15',
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
