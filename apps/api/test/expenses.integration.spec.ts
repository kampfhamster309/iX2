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
import { AccountType } from '@prisma/client';
import * as path from 'path';
import * as os from 'os';

let app: NestFastifyApplication;
let prisma: PrismaService;

// IDs of seeded accounts
let bankAccountId: string;
let accountsPayableAccountId: string;
let maintenanceAccountId: string;

beforeAll(async () => {
  // Apply migrations to test DB
  execSync('pnpm prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env },
    stdio: 'inherit',
  });

  // Set UPLOAD_DIR before module compilation so StorageService picks it up
  const testUploadDir = path.join(os.tmpdir(), 'ix2-test-uploads');
  process.env.UPLOAD_DIR = testUploadDir;

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Register multipart + static before init (same as main.ts bootstrap)
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(fastifyStatic, {
    root: testUploadDir,
    prefix: '/uploads/',
    serve: false,
  });

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
    {
      code: '6100',
      name: 'Property Insurance',
      nameDe: 'Gebäudeversicherung',
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
  const apAccount = await prisma.account.findUnique({ where: { code: '2200' } });
  const maintenanceAccount = await prisma.account.findUnique({ where: { code: '6000' } });

  bankAccountId = bankAccount!.id;
  accountsPayableAccountId = apAccount!.id;
  maintenanceAccountId = maintenanceAccount!.id;
});

beforeEach(async () => {
  // Truncate in correct FK order
  await prisma.payable.deleteMany();
  await prisma.expense.deleteMany();
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

async function createTestProperty(): Promise<string> {
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
  return property.id;
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

describe('POST /accounting/expenses (create paid expense)', () => {
  it('creates a paid expense, posts DR expense / CR Bank, payable is null', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 500,
        date: '2026-03-01',
        description: 'Plumbing repair',
        vendor: 'Fix-It Ltd',
        isPaid: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { id: string; isPaid: boolean; payable: null };
    expect(body.isPaid).toBe(true);
    expect(body.payable).toBeNull();

    // Verify journal: expense account debited, bank credited
    const expenseBalance = await getAccountBalance(token, maintenanceAccountId);
    expect(expenseBalance.totalDebit).toBe(500);

    const bankBalance = await getAccountBalance(token, bankAccountId);
    expect(bankBalance.totalCredit).toBe(500);
  });
});

describe('POST /accounting/expenses (create unpaid expense)', () => {
  it('creates an unpaid expense, posts DR expense / CR AP, payable.status = PENDING', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 800,
        date: '2026-03-10',
        description: 'Roof inspection',
        isPaid: false,
        dueDate: '2026-04-01',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as {
      id: string;
      isPaid: boolean;
      payable: { status: string; dueDate: string };
    };
    expect(body.isPaid).toBe(false);
    expect(body.payable).not.toBeNull();
    expect(body.payable.status).toBe('PENDING');

    // AP should be credited
    const apBalance = await getAccountBalance(token, accountsPayableAccountId);
    expect(apBalance.totalCredit).toBe(800);
  });

  it('returns 400 when isPaid=false and dueDate is missing', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 300,
        date: '2026-03-01',
        description: 'No due date',
        isPaid: false,
        // dueDate omitted
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when accountId is not an EXPENSE account', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: bankAccountId, // ASSET account — should fail
        amount: 300,
        date: '2026-03-01',
        description: 'Wrong account type',
        isPaid: true,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('expense account');
  });
});

describe('POST /accounting/expenses/:id/pay', () => {
  it('pays an unpaid expense — payable.status = PAID, DR AP / CR Bank', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    // Create unpaid expense
    const createRes = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 1000,
        date: '2026-03-10',
        description: 'Electrical work',
        isPaid: false,
        dueDate: '2026-04-10',
      },
    });

    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as { id: string };

    // Pay the expense
    const payRes = await app.inject({
      method: 'POST',
      url: `/accounting/expenses/${created.id}/pay`,
      headers: { authorization: token },
      payload: { paymentDate: '2026-03-15' },
    });

    expect(payRes.statusCode).toBe(201);
    const paid = JSON.parse(payRes.body) as {
      isPaid: boolean;
      payable: { status: string; paidAt: string };
    };
    expect(paid.isPaid).toBe(true);
    expect(paid.payable.status).toBe('PAID');
    expect(paid.payable.paidAt).toBeTruthy();

    // Verify journal entries: AP debited, Bank credited
    const apBalance = await getAccountBalance(token, accountsPayableAccountId);
    expect(apBalance.totalDebit).toBe(1000); // payment debit
    expect(apBalance.totalCredit).toBe(1000); // original expense credit

    const bankBalance = await getAccountBalance(token, bankAccountId);
    expect(bankBalance.totalCredit).toBe(1000); // payment credit
  });

  it('returns 400 when trying to pay an already-paid expense', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    // Create paid expense
    const createRes = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 200,
        date: '2026-03-01',
        description: 'Already paid',
        isPaid: true,
      },
    });

    const created = JSON.parse(createRes.body) as { id: string };

    const payRes = await app.inject({
      method: 'POST',
      url: `/accounting/expenses/${created.id}/pay`,
      headers: { authorization: token },
      payload: { paymentDate: '2026-03-15' },
    });

    expect(payRes.statusCode).toBe(400);
    const body = JSON.parse(payRes.body) as { message: string };
    expect(body.message.toLowerCase()).toContain('already paid');
  });
});

describe('GET /accounting/expenses (filtering)', () => {
  it('filters by propertyId — returns correct subset', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');

    const propertyId1 = await createTestProperty();

    const owner2 = await prisma.owner.create({ data: { name: 'Owner 2' } });
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
    const propertyId2 = property2.id;

    // Create expense on property 1
    await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId: propertyId1,
        accountId: maintenanceAccountId,
        amount: 100,
        date: '2026-03-01',
        description: 'Expense P1',
        isPaid: true,
      },
    });

    // Create expense on property 2
    await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId: propertyId2,
        accountId: maintenanceAccountId,
        amount: 200,
        date: '2026-03-01',
        description: 'Expense P2',
        isPaid: true,
      },
    });

    // Filter by propertyId1
    const res = await app.inject({
      method: 'GET',
      url: `/accounting/expenses?propertyId=${propertyId1}`,
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ propertyId: string }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0].propertyId).toBe(propertyId1);
  });

  it('filters by isPaid=false — returns only unpaid expenses', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    // Create paid expense
    await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 100,
        date: '2026-03-01',
        description: 'Paid expense',
        isPaid: true,
      },
    });

    // Create unpaid expense
    await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 200,
        date: '2026-03-02',
        description: 'Unpaid expense',
        isPaid: false,
        dueDate: '2026-04-01',
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/accounting/expenses?isPaid=false',
      headers: { authorization: token },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      data: Array<{ isPaid: boolean }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.data[0].isPaid).toBe(false);
  });
});

describe('Receipt upload and download', () => {
  it('uploads a receipt and verifies receiptPath is set, then downloads', async () => {
    const token = await createUserWithRole('admin@test.local', 'Admin1234!', 'ADMIN');
    const propertyId = await createTestProperty();

    // Create expense first
    const createRes = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 150,
        date: '2026-03-01',
        description: 'Repair with receipt',
        isPaid: true,
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as { id: string; receiptPath: null };
    expect(created.receiptPath).toBeNull();

    // Upload receipt via multipart
    const fileContent = Buffer.from('test receipt content');
    const boundary = '----TestBoundary123';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="receipt"; filename="receipt.txt"',
      'Content-Type: text/plain',
      '',
      fileContent.toString(),
      `--${boundary}--`,
    ].join('\r\n');

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/accounting/expenses/${created.id}/receipt`,
      headers: {
        authorization: token,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: body,
    });

    expect(uploadRes.statusCode).toBe(201);
    const uploaded = JSON.parse(uploadRes.body) as { receiptPath: string };
    expect(uploaded.receiptPath).not.toBeNull();
    expect(uploaded.receiptPath).toContain('receipts');

    // Download receipt
    const downloadRes = await app.inject({
      method: 'GET',
      url: `/accounting/expenses/${created.id}/receipt`,
      headers: { authorization: token },
    });

    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.body).toContain('test receipt content');
  });
});

describe('RBAC — non-ACCOUNTANT/ADMIN cannot create expense', () => {
  it('TENANT token gets 403 on POST /accounting/expenses', async () => {
    const token = await createUserWithRole('tenant@test.local', 'Tenant1234!', 'TENANT');
    const propertyId = await createTestProperty();

    const res = await app.inject({
      method: 'POST',
      url: '/accounting/expenses',
      headers: { authorization: token },
      payload: {
        propertyId,
        accountId: maintenanceAccountId,
        amount: 100,
        date: '2026-03-01',
        description: 'Should be blocked',
        isPaid: true,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});
