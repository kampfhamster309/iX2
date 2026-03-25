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
let rentReceivableAccountId: string;
let rentalIncomeAccountId: string;

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

  const bankAccount = await prisma.account.findUnique({ where: { code: '1000' } });
  const rentReceivableAccount = await prisma.account.findUnique({ where: { code: '1100' } });
  const rentalIncomeAccount = await prisma.account.findUnique({ where: { code: '4000' } });

  bankAccountId = bankAccount!.id;
  rentReceivableAccountId = rentReceivableAccount!.id;
  rentalIncomeAccountId = rentalIncomeAccount!.id;
});

beforeEach(async () => {
  // Truncate in correct FK order
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.propertyManager.deleteMany();
  await prisma.propertyNote.deleteMany();
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

async function createTestProperty(
  adminUserId: string,
): Promise<{ propertyId: string; unitId: string }> {
  const owner = await prisma.owner.create({
    data: { name: 'Test Owner', email: 'owner@test.local' },
  });

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

  const unit = await prisma.unit.create({
    data: {
      name: 'Unit 1',
      type: 'RESIDENTIAL',
      propertyId: property.id,
    },
  });

  // Assign the admin as manager so they can manage it
  await prisma.propertyManager.create({
    data: { propertyId: property.id, userId: adminUserId },
  });

  return { propertyId: property.id, unitId: unit.id };
}

async function createTestTenant(): Promise<string> {
  const tenant = await prisma.tenant.create({
    data: {
      firstName: 'Test',
      lastName: 'Tenant',
      email: 'testtenant@test.local',
    },
  });
  return tenant.id;
}

async function createTestContract(
  unitId: string,
  tenantId: string,
  rentAmount: number,
): Promise<string> {
  const contract = await prisma.contract.create({
    data: {
      unitId,
      tenantId,
      startDate: new Date('2026-01-01'),
      rentAmount,
      status: 'ACTIVE',
      type: ContractType.RESIDENTIAL_LEASE,
    },
  });
  return contract.id;
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

describe('POST /accounting/invoices/generate', () => {
  it('generates DRAFT invoices for all active contracts with correct amounts and dueDate', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });

    const { unitId: unitId1 } = await createTestProperty(admin!.id);
    const owner2 = await prisma.owner.create({
      data: { name: 'Owner 2', email: 'owner2@test.local' },
    });
    const property2 = await prisma.property.create({
      data: {
        name: 'Property 2',
        address: 'Street 2',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        ownerId: owner2.id,
      },
    });
    const unit2 = await prisma.unit.create({
      data: { name: 'Unit 2', type: 'RESIDENTIAL', propertyId: property2.id },
    });

    const tenantId1 = await createTestTenant();
    const tenant2 = await prisma.tenant.create({
      data: { firstName: 'Second', lastName: 'Tenant' },
    });

    await createTestContract(unitId1, tenantId1, 1000);
    await createTestContract(unit2.id, tenant2.id, 1500);

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { created: number; skipped: number };
    expect(body.created).toBe(2);
    expect(body.skipped).toBe(0);

    // Verify invoices in DB
    const invoices = await prisma.invoice.findMany({ orderBy: { amountDue: 'asc' } });
    expect(invoices).toHaveLength(2);
    expect(Number(invoices[0].amountDue)).toBe(1000);
    expect(Number(invoices[1].amountDue)).toBe(1500);
    expect(invoices[0].status).toBe('DRAFT');
    expect(invoices[0].periodMonth).toBe(3);
    expect(invoices[0].periodYear).toBe(2026);

    // Due date should be the 3rd of the month
    const dueDate = new Date(invoices[0].dueDate);
    expect(dueDate.getDate()).toBe(3);
    expect(dueDate.getMonth()).toBe(2); // March = 2 (0-indexed)
    expect(dueDate.getFullYear()).toBe(2026);
  });

  it('is idempotent — second call returns { created: 0, skipped: 2 }', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1200);

    const owner2 = await prisma.owner.create({ data: { name: 'O2' } });
    const prop2 = await prisma.property.create({
      data: {
        name: 'P2',
        address: 'A2',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        ownerId: owner2.id,
      },
    });
    const unit2 = await prisma.unit.create({
      data: { name: 'U2', type: 'RESIDENTIAL', propertyId: prop2.id },
    });
    const tenant2 = await prisma.tenant.create({ data: { firstName: 'T2', lastName: 'T2' } });
    await createTestContract(unit2.id, tenant2.id, 800);

    // First call
    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 4, year: 2026 },
    });

    // Second call — must be idempotent
    const res2 = await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 4, year: 2026 },
    });

    expect(res2.statusCode).toBe(201);
    const body = JSON.parse(res2.body) as { created: number; skipped: number };
    expect(body.created).toBe(0);
    expect(body.skipped).toBe(2);
  });
});

describe('POST /accounting/invoices/:id/issue', () => {
  it('transitions DRAFT → ISSUED and posts DR Rent Receivable / CR Rental Income', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    // Generate invoice
    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    // Issue the invoice
    const issueRes = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    expect(issueRes.statusCode).toBe(201);
    const issuedInvoice = JSON.parse(issueRes.body) as { status: string; issuedAt: string };
    expect(issuedInvoice.status).toBe('ISSUED');
    expect(issuedInvoice.issuedAt).toBeTruthy();

    // Verify account balances
    const rentReceivableBalance = await getAccountBalance(token, rentReceivableAccountId);
    expect(rentReceivableBalance.totalDebit).toBe(1000);
    expect(rentReceivableBalance.totalCredit).toBe(0);

    const rentalIncomeBalance = await getAccountBalance(token, rentalIncomeAccountId);
    expect(rentalIncomeBalance.totalDebit).toBe(0);
    expect(rentalIncomeBalance.totalCredit).toBe(1000);
  });

  it('returns 400 if invoice is already ISSUED', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    // Issue once
    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    // Issue again — should return 400
    const res2 = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    expect(res2.statusCode).toBe(400);
    const body = JSON.parse(res2.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('already issued');
  });
});

describe('POST /accounting/invoices/:id/payments', () => {
  it('full payment — transitions invoice to PAID and updates account balances', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    const payRes = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 1000, paymentDate: '2026-03-10' },
    });

    expect(payRes.statusCode).toBe(201);

    // Verify invoice is PAID
    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(updatedInvoice!.status).toBe('PAID');

    // Verify bank account balance increased (DR Bank)
    const bankBalance = await getAccountBalance(token, bankAccountId);
    expect(bankBalance.totalDebit).toBe(1000);

    // Verify rent receivable credit increased
    const rentReceivableBalance = await getAccountBalance(token, rentReceivableAccountId);
    expect(rentReceivableBalance.totalCredit).toBe(1000);
  });

  it('partial payment — transitions to PARTIALLY_PAID; second payment completes → PAID', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    // Partial payment
    const partialRes = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 600, paymentDate: '2026-03-10' },
    });
    expect(partialRes.statusCode).toBe(201);

    const partialInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(partialInvoice!.status).toBe('PARTIALLY_PAID');

    // Remaining payment
    const remainRes = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 400, paymentDate: '2026-03-15' },
    });
    expect(remainRes.statusCode).toBe(201);

    const paidInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(paidInvoice!.status).toBe('PAID');
  });

  it('overpayment is rejected with 400', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 1500, paymentDate: '2026-03-10' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('overpayments are not accepted');
  });

  it('returns 400 when recording payment on DRAFT invoice', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    // Do NOT issue the invoice — try to pay directly
    const res = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 1000, paymentDate: '2026-03-10' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('must be issued');
  });

  it('returns 400 when recording payment on PAID invoice', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    const invoices = await prisma.invoice.findMany();
    const invoiceId = invoices[0].id;

    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/issue`,
      headers: { authorization: token },
    });

    // Pay in full
    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 1000, paymentDate: '2026-03-10' },
    });

    // Try to pay again
    const res = await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${invoiceId}/payments`,
      headers: { authorization: token },
      payload: { amount: 100, paymentDate: '2026-03-11' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('paid');
  });
});

describe('GET /accounting/invoices/overdue/mark', () => {
  it('marks ISSUED invoices with past due dates as OVERDUE', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    const contractId = await createTestContract(unitId, tenantId, 1000);

    // Create an invoice with a past due date directly via prisma
    const invoice = await prisma.invoice.create({
      data: {
        contractId,
        periodMonth: 1,
        periodYear: 2025,
        amountDue: 1000,
        dueDate: new Date('2025-01-03'), // past date
        status: 'ISSUED',
        issuedAt: new Date('2025-01-01'),
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/invoices/overdue/mark',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { updated: number };
    expect(body.updated).toBe(1);

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    expect(updatedInvoice!.status).toBe('OVERDUE');
  });
});

describe('GET /accounting/invoices', () => {
  it('filters by status correctly', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);
    const tenantId = await createTestTenant();
    await createTestContract(unitId, tenantId, 1000);

    // Generate invoices for two months
    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 4, year: 2026 },
    });

    // Issue only the March invoice
    const allInvoices = await prisma.invoice.findMany({ orderBy: { periodMonth: 'asc' } });
    await app.inject({
      method: 'POST',
      url: `/accounting/invoices/${allInvoices[0].id}/issue`,
      headers: { authorization: token },
    });

    // Filter by ISSUED
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/invoices?status=ISSUED',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ status: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0].status).toBe('ISSUED');
  });

  it('filters by contractId correctly', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const admin = await prisma.user.findUnique({ where: { email: 'admin@test.local' } });
    const { unitId } = await createTestProperty(admin!.id);

    const owner2 = await prisma.owner.create({ data: { name: 'O2' } });
    const prop2 = await prisma.property.create({
      data: {
        name: 'P2',
        address: 'A2',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        ownerId: owner2.id,
      },
    });
    const unit2 = await prisma.unit.create({
      data: { name: 'U2', type: 'RESIDENTIAL', propertyId: prop2.id },
    });

    const tenantId1 = await createTestTenant();
    const tenant2 = await prisma.tenant.create({ data: { firstName: 'T2', lastName: 'T2' } });

    const contractId1 = await createTestContract(unitId, tenantId1, 1000);
    await createTestContract(unit2.id, tenant2.id, 1500);

    // Generate invoices for both contracts
    await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    // Filter by contractId1
    const res = await app.inject({
      method: 'GET',
      url: `/accounting/invoices?contractId=${contractId1}`,
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ contractId: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0].contractId).toBe(contractId1);
  });
});

describe('RBAC — non-ACCOUNTANT/ADMIN cannot generate invoices', () => {
  it('TENANT token gets 403 on POST /accounting/invoices/generate', async () => {
    const token = await createUserWithRole('tenant@test.local', 'Tenant1234!', 'TENANT');

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/invoices/generate',
      headers: { authorization: token },
      payload: { month: 3, year: 2026 },
    });

    expect(res.statusCode).toBe(403);
  });
});
