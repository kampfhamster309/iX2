import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../.env.test') });

import { Test, TestingModule } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { execSync } from 'child_process';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AccountType } from '@prisma/client';

let app: NestFastifyApplication;
let prisma: PrismaService;

// IDs of seeded accounts (populated in beforeAll)
let bankAccountId: string;
let rentalIncomeAccountId: string;
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

  // Seed chart of accounts directly in the test setup
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
      code: '1200',
      name: 'Security Deposits Held',
      nameDe: 'Kautionen bei Banken',
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
      code: '2100',
      name: 'VAT Payable',
      nameDe: 'Umsatzsteuerverbindlichkeiten',
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
      code: '3100',
      name: 'Retained Earnings',
      nameDe: 'Gewinnvortrag',
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
      code: '4100',
      name: 'Late Fee Income',
      nameDe: 'Mahngebühren',
      type: AccountType.INCOME,
      isSystem: true,
    },
    {
      code: '4200',
      name: 'Other Income',
      nameDe: 'Sonstige Einnahmen',
      type: AccountType.INCOME,
      isSystem: false,
    },
    {
      code: '6000',
      name: 'Maintenance & Repairs',
      nameDe: 'Instandhaltung und Reparaturen',
      type: AccountType.EXPENSE,
      isSystem: true,
    },
    {
      code: '6100',
      name: 'Property Insurance',
      nameDe: 'Gebäudeversicherung',
      type: AccountType.EXPENSE,
      isSystem: true,
    },
    {
      code: '6200',
      name: 'Property Management Fees',
      nameDe: 'Hausverwaltungsgebühren',
      type: AccountType.EXPENSE,
      isSystem: true,
    },
    {
      code: '6300',
      name: 'Utilities',
      nameDe: 'Betriebskosten',
      type: AccountType.EXPENSE,
      isSystem: true,
    },
    {
      code: '6400',
      name: 'Depreciation',
      nameDe: 'Abschreibungen',
      type: AccountType.EXPENSE,
      isSystem: true,
    },
    {
      code: '6500',
      name: 'Other Expenses',
      nameDe: 'Sonstige Aufwendungen',
      type: AccountType.EXPENSE,
      isSystem: false,
    },
  ];

  for (const account of chartOfAccounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  // Resolve account IDs for use in tests
  const bankAccount = await prisma.account.findUnique({ where: { code: '1000' } });
  const rentalIncomeAccount = await prisma.account.findUnique({ where: { code: '4000' } });
  const maintenanceAccount = await prisma.account.findUnique({ where: { code: '6000' } });

  bankAccountId = bankAccount!.id;
  rentalIncomeAccountId = rentalIncomeAccount!.id;
  maintenanceAccountId = maintenanceAccount!.id;
});

beforeEach(async () => {
  // Truncate journal data before each test, keep accounts (seeded once)
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  // Also clean user-related tables for clean auth state
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function registerUser(email: string, password: string) {
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

async function createAdminToken(): Promise<string> {
  await registerUser('admin@test.local', 'Admin1234!');
  await prisma.user.update({
    where: { email: 'admin@test.local' },
    data: { role: 'ADMIN' },
  });
  return loginAs('admin@test.local', 'Admin1234!');
}

async function createAccountantToken(): Promise<string> {
  await registerUser('accountant@test.local', 'Accountant1234!');
  await prisma.user.update({
    where: { email: 'accountant@test.local' },
    data: { role: 'ACCOUNTANT' },
  });
  return loginAs('accountant@test.local', 'Accountant1234!');
}

async function createTenantToken(): Promise<string> {
  await registerUser('tenant@test.local', 'Tenant1234!');
  // TENANT is the default role, no update needed
  return loginAs('tenant@test.local', 'Tenant1234!');
}

async function postJournalEntry(
  token: string,
  lines: Array<{ accountId: string; debit?: number; credit?: number; description?: string }>,
  date = '2026-03-01',
  description = 'Test entry',
  propertyId?: string,
) {
  return app.inject({
    method: 'POST',
    url: '/accounting/journal-entries',
    headers: { authorization: token },
    payload: { date, description, lines, ...(propertyId ? { propertyId } : {}) },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /accounting/accounts', () => {
  it('returns at least 17 seeded accounts including code 1000 and 4000', async () => {
    const token = await createAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/accounts',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const accounts = JSON.parse(res.body) as Array<{ code: string }>;
    expect(accounts.length).toBeGreaterThanOrEqual(17);
    expect(accounts.some((a) => a.code === '1000')).toBe(true);
    expect(accounts.some((a) => a.code === '4000')).toBe(true);
  });
});

describe('POST /accounting/journal-entries', () => {
  it('posts a balanced 2-line entry and returns 201 with lines', async () => {
    const token = await createAdminToken();
    const res = await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 1000.0 },
        { accountId: rentalIncomeAccountId, credit: 1000.0 },
      ],
      '2026-03-01',
      'Rent payment received',
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; lines: unknown[] };
    expect(body).toHaveProperty('id');
    expect(body.lines).toHaveLength(2);
  });

  it('returns 400 for unbalanced entry (debit 1000 != credit 900)', async () => {
    const token = await createAdminToken();
    const res = await postJournalEntry(token, [
      { accountId: bankAccountId, debit: 1000.0 },
      { accountId: rentalIncomeAccountId, credit: 900.0 },
    ]);

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('unbalanced');
  });

  it('returns 400 when a line has both debit and credit non-zero', async () => {
    const token = await createAdminToken();
    const res = await postJournalEntry(token, [
      { accountId: bankAccountId, debit: 100, credit: 100 },
      { accountId: rentalIncomeAccountId, credit: 100 },
    ]);

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when a line has both sides zero', async () => {
    const token = await createAdminToken();
    const res = await postJournalEntry(token, [
      { accountId: bankAccountId, debit: 0, credit: 0 },
      { accountId: rentalIncomeAccountId, credit: 500 },
    ]);

    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when a TENANT tries to post an entry', async () => {
    const token = await createTenantToken();
    const res = await postJournalEntry(token, [
      { accountId: bankAccountId, debit: 1000.0 },
      { accountId: rentalIncomeAccountId, credit: 1000.0 },
    ]);

    expect(res.statusCode).toBe(403);
  });

  it('allows ACCOUNTANT role to post entries', async () => {
    const token = await createAccountantToken();
    const res = await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 500.0 },
        { accountId: rentalIncomeAccountId, credit: 500.0 },
      ],
      '2026-03-01',
      'Accountant test entry',
    );

    expect(res.statusCode).toBe(201);
  });
});

describe('GET /accounting/accounts/:id/balance', () => {
  it('returns correct balance after posting an entry', async () => {
    const token = await createAdminToken();

    // Post a 1500.00 debit to bank account
    await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 1500.0 },
        { accountId: rentalIncomeAccountId, credit: 1500.0 },
      ],
      '2026-03-01',
      'Rent received',
    );

    const res = await app.inject({
      method: 'GET',
      url: `/accounting/accounts/${bankAccountId}/balance`,
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      accountId: string;
      totalDebit: number;
      totalCredit: number;
      balance: number;
    };
    expect(body.accountId).toBe(bankAccountId);
    expect(body.totalDebit).toBe(1500);
    expect(body.totalCredit).toBe(0);
    expect(body.balance).toBe(1500);
  });
});

describe('GET /accounting/journal-entries filtering', () => {
  it('filters by dateFrom and dateTo correctly', async () => {
    const token = await createAdminToken();

    // Post entry on 2026-01-15
    await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 100.0 },
        { accountId: rentalIncomeAccountId, credit: 100.0 },
      ],
      '2026-01-15',
      'January entry',
    );

    // Post entry on 2026-03-15
    await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 200.0 },
        { accountId: rentalIncomeAccountId, credit: 200.0 },
      ],
      '2026-03-15',
      'March entry',
    );

    // Filter for February only
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/journal-entries?dateFrom=2026-02-01&dateTo=2026-02-28',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: unknown[]; total: number };
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);

    // Filter for March
    const marchRes = await app.inject({
      method: 'GET',
      url: '/accounting/journal-entries?dateFrom=2026-03-01&dateTo=2026-03-31',
      headers: { authorization: token },
    });

    expect(marchRes.statusCode).toBe(200);
    const marchBody = JSON.parse(marchRes.body) as {
      data: Array<{ description: string }>;
      total: number;
    };
    expect(marchBody.total).toBe(1);
    expect(marchBody.data[0].description).toBe('March entry');
  });

  it('filters by accountId correctly', async () => {
    const token = await createAdminToken();

    // Post entry using bank + rental income
    await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 300.0 },
        { accountId: rentalIncomeAccountId, credit: 300.0 },
      ],
      '2026-03-01',
      'Entry with bank',
    );

    // Post entry using maintenance + bank (different account mix)
    await postJournalEntry(
      token,
      [
        { accountId: maintenanceAccountId, debit: 150.0 },
        { accountId: bankAccountId, credit: 150.0 },
      ],
      '2026-03-02',
      'Maintenance payment',
    );

    // Filter by maintenanceAccountId - should return only the second entry
    const res = await app.inject({
      method: 'GET',
      url: `/accounting/journal-entries?accountId=${maintenanceAccountId}`,
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ description: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0].description).toBe('Maintenance payment');
  });

  it('filters by propertyId correctly', async () => {
    const token = await createAdminToken();

    // Post entry WITH propertyId
    const res1 = await app.inject({
      method: 'POST',
      url: '/accounting/journal-entries',
      headers: { authorization: token },
      payload: {
        date: '2026-03-01',
        description: 'Property-specific entry',
        propertyId: 'test-property-abc',
        lines: [
          { accountId: bankAccountId, debit: 400.0 },
          { accountId: rentalIncomeAccountId, credit: 400.0 },
        ],
      },
    });
    expect(res1.statusCode).toBe(201);

    // Post entry WITHOUT propertyId
    await postJournalEntry(
      token,
      [
        { accountId: bankAccountId, debit: 500.0 },
        { accountId: rentalIncomeAccountId, credit: 500.0 },
      ],
      '2026-03-02',
      'No property entry',
    );

    // Filter by the propertyId
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/journal-entries?propertyId=test-property-abc',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { data: Array<{ description: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0].description).toBe('Property-specific entry');
  });
});
