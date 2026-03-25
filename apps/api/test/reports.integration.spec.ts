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

// Account IDs
let bankId: string;
let rentalIncomeId: string;
let maintenanceId: string;
let equityId: string;

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

  // Seed chart of accounts
  const accounts = [
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

  for (const acc of accounts) {
    await prisma.account.upsert({ where: { code: acc.code }, update: {}, create: acc });
  }

  bankId = (await prisma.account.findUnique({ where: { code: '1000' } }))!.id;
  rentalIncomeId = (await prisma.account.findUnique({ where: { code: '4000' } }))!.id;
  maintenanceId = (await prisma.account.findUnique({ where: { code: '6000' } }))!.id;
  equityId = (await prisma.account.findUnique({ where: { code: '3000' } }))!.id;
});

beforeEach(async () => {
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.invoice.deleteMany();
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

async function createAdminToken(): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email: 'admin@rpt.local', password: 'Admin1234!' },
  });
  await prisma.user.update({ where: { email: 'admin@rpt.local' }, data: { role: 'ADMIN' } });
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'admin@rpt.local', password: 'Admin1234!' },
  });
  return `Bearer ${(JSON.parse(res.body) as { accessToken: string }).accessToken}`;
}

async function postEntry(
  token: string,
  lines: Array<{ accountId: string; debit?: number; credit?: number }>,
  date = '2026-03-01',
  description = 'Test',
  propertyId?: string,
) {
  return app.inject({
    method: 'POST',
    url: '/accounting/journal-entries',
    headers: { authorization: token },
    payload: { date, description, lines, ...(propertyId ? { propertyId } : {}) },
  });
}

// ─── Trial Balance ─────────────────────────────────────────────────────────────

describe('GET /accounting/reports/trial-balance', () => {
  it('returns isBalanced=true on an empty ledger', async () => {
    const token = await createAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      isBalanced: boolean;
      grandTotalDebit: number;
      grandTotalCredit: number;
    };
    expect(body.isBalanced).toBe(true);
    expect(body.grandTotalDebit).toBe(0);
    expect(body.grandTotalCredit).toBe(0);
  });

  it('grandTotalDebit equals grandTotalCredit after posting balanced entries', async () => {
    const token = await createAdminToken();

    // Post 3 balanced entries
    // Entry 1: DR Bank 1000 / CR Rental Income 1000
    await postEntry(token, [
      { accountId: bankId, debit: 1000, credit: 0 },
      { accountId: rentalIncomeId, debit: 0, credit: 1000 },
    ]);
    // Entry 2: DR Maintenance 500 / CR Bank 500
    await postEntry(token, [
      { accountId: maintenanceId, debit: 500, credit: 0 },
      { accountId: bankId, debit: 0, credit: 500 },
    ]);
    // Entry 3: DR Bank 200 / CR Equity 200
    await postEntry(token, [
      { accountId: bankId, debit: 200, credit: 0 },
      { accountId: equityId, debit: 0, credit: 200 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      isBalanced: boolean;
      grandTotalDebit: number;
      grandTotalCredit: number;
      rows: Array<{ code: string; totalDebit: number; totalCredit: number }>;
    };
    expect(body.isBalanced).toBe(true);
    expect(body.grandTotalDebit).toBe(body.grandTotalCredit);
    expect(body.grandTotalDebit).toBe(1700); // 1000+500+200

    // Bank: DR 1000+200=1200, CR 500
    const bankRow = body.rows.find((r) => r.code === '1000');
    expect(bankRow?.totalDebit).toBe(1200);
    expect(bankRow?.totalCredit).toBe(500);
  });

  it('filters by date range', async () => {
    const token = await createAdminToken();
    // Jan entry
    await postEntry(
      token,
      [
        { accountId: bankId, debit: 300, credit: 0 },
        { accountId: rentalIncomeId, debit: 0, credit: 300 },
      ],
      '2026-01-15',
    );
    // March entry
    await postEntry(
      token,
      [
        { accountId: bankId, debit: 700, credit: 0 },
        { accountId: rentalIncomeId, debit: 0, credit: 700 },
      ],
      '2026-03-15',
    );

    // Query only March
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance?dateFrom=2026-03-01&dateTo=2026-03-31',
      headers: { authorization: token },
    });
    const body = JSON.parse(res.body) as { grandTotalDebit: number };
    expect(body.grandTotalDebit).toBe(700);
  });

  it('rejects TENANT role with 403', async () => {
    await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'tenant@rpt.local', password: 'Tenant1234!' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'tenant@rpt.local', password: 'Tenant1234!' },
    });
    const token = `Bearer ${(JSON.parse(loginRes.body) as { accessToken: string }).accessToken}`;
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ─── P&L ──────────────────────────────────────────────────────────────────────

describe('GET /accounting/reports/profit-loss', () => {
  it('returns correct income, expenses, and net income', async () => {
    const token = await createAdminToken();

    // Income: 2 × rent collection into bank
    // Entry 1: DR Bank 800 / CR Rental Income 800
    await postEntry(token, [
      { accountId: bankId, debit: 800, credit: 0 },
      { accountId: rentalIncomeId, debit: 0, credit: 800 },
    ]);
    // Entry 2: DR Bank 1200 / CR Rental Income 1200
    await postEntry(token, [
      { accountId: bankId, debit: 1200, credit: 0 },
      { accountId: rentalIncomeId, debit: 0, credit: 1200 },
    ]);
    // Expense: maintenance paid
    // Entry 3: DR Maintenance 300 / CR Bank 300
    await postEntry(token, [
      { accountId: maintenanceId, debit: 300, credit: 0 },
      { accountId: bankId, debit: 0, credit: 300 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/profit-loss',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      totalIncome: number;
      totalExpenses: number;
      netIncome: number;
      income: Array<{ code: string; amount: number }>;
      expenses: Array<{ code: string; amount: number }>;
    };

    expect(body.totalIncome).toBe(2000); // 800 + 1200
    expect(body.totalExpenses).toBe(300);
    expect(body.netIncome).toBe(1700); // 2000 - 300

    const rentalIncomeRow = body.income.find((r) => r.code === '4000');
    expect(rentalIncomeRow?.amount).toBe(2000);

    const maintenanceRow = body.expenses.find((r) => r.code === '6000');
    expect(maintenanceRow?.amount).toBe(300);
  });

  it('P&L with no transactions returns zero net income', async () => {
    const token = await createAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/profit-loss',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { netIncome: number };
    expect(body.netIncome).toBe(0);
  });
});

// ─── Balance Sheet ─────────────────────────────────────────────────────────────

describe('GET /accounting/reports/balance-sheet', () => {
  it('returns correct asset and equity totals', async () => {
    const token = await createAdminToken();

    // Initial equity contribution: DR Bank 5000 / CR Equity 5000
    await postEntry(token, [
      { accountId: bankId, debit: 5000, credit: 0 },
      { accountId: equityId, debit: 0, credit: 5000 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/balance-sheet',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      totalAssets: number;
      totalLiabilities: number;
      totalEquity: number;
      isBalanced: boolean;
    };

    expect(body.totalAssets).toBe(5000);
    expect(body.totalEquity).toBe(5000);
    expect(body.totalLiabilities).toBe(0);
    expect(body.isBalanced).toBe(true);
  });
});

// ─── Rent Roll ─────────────────────────────────────────────────────────────────

describe('GET /accounting/reports/rent-roll', () => {
  it('returns active contracts with rent amounts', async () => {
    const token = await createAdminToken();

    // Create an owner, property, unit, tenant, and contract
    const owner = await prisma.owner.create({ data: { name: 'Test Owner' } });
    const property = await prisma.property.create({
      data: {
        name: 'Test Property',
        address: 'Musterstraße 1',
        city: 'Berlin',
        postalCode: '10115',
        ownerId: owner.id,
      },
    });
    const unit = await prisma.unit.create({
      data: { name: 'Unit 1', type: 'RESIDENTIAL', propertyId: property.id },
    });
    const tenant = await prisma.tenant.create({
      data: { firstName: 'Hans', lastName: 'Müller' },
    });
    await prisma.contract.create({
      data: {
        unitId: unit.id,
        tenantId: tenant.id,
        startDate: new Date('2026-01-01'),
        rentAmount: 900,
        type: ContractType.RESIDENTIAL_LEASE,
        status: 'ACTIVE',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/rent-roll',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      count: number;
      rows: Array<{ rentAmount: number; tenantName: string; outstandingBalance: number }>;
    };

    expect(body.count).toBe(1);
    expect(body.rows[0].rentAmount).toBe(900);
    expect(body.rows[0].tenantName).toBe('Hans Müller');
    expect(body.rows[0].outstandingBalance).toBe(0); // no invoices yet
  });
});

// ─── Cash Flow ─────────────────────────────────────────────────────────────────

describe('GET /accounting/reports/cash-flow', () => {
  it('returns cash in, cash out, and net cash flow', async () => {
    const token = await createAdminToken();

    // Cash in: DR Bank 1000 / CR Rental Income 1000
    await postEntry(token, [
      { accountId: bankId, debit: 1000, credit: 0 },
      { accountId: rentalIncomeId, debit: 0, credit: 1000 },
    ]);
    // Cash out: DR Maintenance 400 / CR Bank 400
    await postEntry(token, [
      { accountId: maintenanceId, debit: 400, credit: 0 },
      { accountId: bankId, debit: 0, credit: 400 },
    ]);

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/cash-flow',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { cashIn: number; cashOut: number; netCashFlow: number };
    expect(body.cashIn).toBe(1000);
    expect(body.cashOut).toBe(400);
    expect(body.netCashFlow).toBe(600);
  });
});

// ─── PDF Exports ───────────────────────────────────────────────────────────────

describe('PDF exports', () => {
  it('GET /accounting/reports/rent-roll/pdf returns a PDF buffer', async () => {
    const token = await createAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/rent-roll/pdf',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    // PDF magic bytes: %PDF
    expect(res.rawPayload.slice(0, 4).toString()).toBe('%PDF');
  });

  it('GET /accounting/reports/profit-loss/pdf returns a PDF buffer', async () => {
    const token = await createAdminToken();
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/profit-loss/pdf',
      headers: { authorization: token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.rawPayload.slice(0, 4).toString()).toBe('%PDF');
  });
});
