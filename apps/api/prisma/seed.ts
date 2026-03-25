import {
  PrismaClient,
  Role,
  UnitType,
  ContractStatus,
  ContractType,
  AccountType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

async function seedChartOfAccounts() {
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

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  console.log(`Seeded ${accounts.length} chart of accounts entries`);
}

async function main() {
  console.log('Seeding database...');

  await seedChartOfAccounts();

  // --- Users ---
  const adminPasswordHash = await bcrypt.hash('Admin1234!', BCRYPT_ROUNDS);
  const managerPasswordHash = await bcrypt.hash('Manager1234!', BCRYPT_ROUNDS);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ix2.local' },
    update: {},
    create: {
      email: 'admin@ix2.local',
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@ix2.local' },
    update: {},
    create: {
      email: 'manager@ix2.local',
      passwordHash: managerPasswordHash,
      role: Role.MANAGER,
    },
  });

  console.log(`Created users: ${adminUser.email}, ${managerUser.email}`);

  // --- Owner ---
  const owner = await prisma.owner.upsert({
    where: { id: 'seed-owner-thomas-weber' },
    update: {},
    create: {
      id: 'seed-owner-thomas-weber',
      name: 'Thomas Weber',
      email: 'thomas.weber@example.de',
      phone: '+49 89 1234567',
      address: 'Maximilianstraße 1, 80539 München',
    },
  });

  console.log(`Created owner: ${owner.name}`);

  // --- Properties ---
  const munichProperty = await prisma.property.upsert({
    where: { id: 'seed-property-musterstrasse' },
    update: {},
    create: {
      id: 'seed-property-musterstrasse',
      name: 'Musterstraße 12',
      address: 'Musterstraße 12',
      city: 'München',
      postalCode: '80333',
      country: 'DE',
      ownerId: owner.id,
      yearBuilt: 1965,
      numberOfFloors: 4,
    },
  });

  const berlinProperty = await prisma.property.upsert({
    where: { id: 'seed-property-hauptstrasse' },
    update: {},
    create: {
      id: 'seed-property-hauptstrasse',
      name: 'Hauptstraße 55',
      address: 'Hauptstraße 55',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
      ownerId: owner.id,
      yearBuilt: 1998,
      numberOfFloors: 6,
    },
  });

  console.log(`Created properties: ${munichProperty.name}, ${berlinProperty.name}`);

  // --- Assign manager to both properties ---
  await prisma.propertyManager.upsert({
    where: {
      propertyId_userId: {
        propertyId: munichProperty.id,
        userId: managerUser.id,
      },
    },
    update: {},
    create: {
      propertyId: munichProperty.id,
      userId: managerUser.id,
    },
  });

  await prisma.propertyManager.upsert({
    where: {
      propertyId_userId: {
        propertyId: berlinProperty.id,
        userId: managerUser.id,
      },
    },
    update: {},
    create: {
      propertyId: berlinProperty.id,
      userId: managerUser.id,
    },
  });

  console.log('Assigned manager to both properties');

  // --- Units for Musterstraße 12 ---
  const munichApt1 = await prisma.unit.upsert({
    where: { id: 'seed-unit-munich-apt1' },
    update: {},
    create: {
      id: 'seed-unit-munich-apt1',
      name: 'Wohnung 1',
      type: UnitType.RESIDENTIAL,
      floor: 0,
      areaSqm: 65.5,
      rooms: 3,
      propertyId: munichProperty.id,
    },
  });

  const munichApt2 = await prisma.unit.upsert({
    where: { id: 'seed-unit-munich-apt2' },
    update: {},
    create: {
      id: 'seed-unit-munich-apt2',
      name: 'Wohnung 2',
      type: UnitType.RESIDENTIAL,
      floor: 1,
      areaSqm: 78.0,
      rooms: 3.5,
      propertyId: munichProperty.id,
    },
  });

  const munichApt3 = await prisma.unit.upsert({
    where: { id: 'seed-unit-munich-apt3' },
    update: {},
    create: {
      id: 'seed-unit-munich-apt3',
      name: 'Wohnung 3',
      type: UnitType.RESIDENTIAL,
      floor: 2,
      areaSqm: 55.0,
      rooms: 2,
      propertyId: munichProperty.id,
    },
  });

  // --- Units for Hauptstraße 55 ---
  const berlinAptA = await prisma.unit.upsert({
    where: { id: 'seed-unit-berlin-apta' },
    update: {},
    create: {
      id: 'seed-unit-berlin-apta',
      name: 'Wohnung A',
      type: UnitType.RESIDENTIAL,
      floor: 1,
      areaSqm: 72.0,
      rooms: 3,
      propertyId: berlinProperty.id,
    },
  });

  const berlinAptB = await prisma.unit.upsert({
    where: { id: 'seed-unit-berlin-aptb' },
    update: {},
    create: {
      id: 'seed-unit-berlin-aptb',
      name: 'Wohnung B',
      type: UnitType.RESIDENTIAL,
      floor: 2,
      areaSqm: 85.0,
      rooms: 4,
      propertyId: berlinProperty.id,
    },
  });

  const berlinCommercial = await prisma.unit.upsert({
    where: { id: 'seed-unit-berlin-commercial' },
    update: {},
    create: {
      id: 'seed-unit-berlin-commercial',
      name: 'Ladenfläche EG',
      type: UnitType.COMMERCIAL,
      floor: 0,
      areaSqm: 120.0,
      propertyId: berlinProperty.id,
    },
  });

  console.log('Created 6 units');

  // --- Tenants ---
  const maxMueller = await prisma.tenant.upsert({
    where: { id: 'seed-tenant-max-mueller' },
    update: {},
    create: {
      id: 'seed-tenant-max-mueller',
      firstName: 'Max',
      lastName: 'Müller',
      email: 'max.mueller@example.de',
      phone: '+49 89 9876543',
      address: 'Alte Straße 5, 80331 München',
    },
  });

  const annaSchmidt = await prisma.tenant.upsert({
    where: { id: 'seed-tenant-anna-schmidt' },
    update: {},
    create: {
      id: 'seed-tenant-anna-schmidt',
      firstName: 'Anna',
      lastName: 'Schmidt',
      email: 'anna.schmidt@example.de',
      phone: '+49 89 5551234',
      address: 'Neustraße 10, 80335 München',
    },
  });

  const exampleGmbH = await prisma.tenant.upsert({
    where: { id: 'seed-tenant-example-gmbh' },
    update: {},
    create: {
      id: 'seed-tenant-example-gmbh',
      firstName: 'Example',
      lastName: 'GmbH',
      email: 'kontakt@example-gmbh.de',
      phone: '+49 30 1234567',
      address: 'Geschäftsstraße 1, 10115 Berlin',
      isCompany: true,
      companyName: 'Example GmbH',
      legalForm: 'GmbH',
    },
  });

  console.log('Created 3 tenants');

  // --- Contracts ---
  // Contract 1: Max Müller → Musterstraße Wohnung 1
  await prisma.contract.upsert({
    where: { id: 'seed-contract-max-munich1' },
    update: {},
    create: {
      id: 'seed-contract-max-munich1',
      unitId: munichApt1.id,
      tenantId: maxMueller.id,
      startDate: new Date('2024-01-01'),
      rentAmount: 950,
      depositAmount: 1900,
      status: ContractStatus.ACTIVE,
      type: ContractType.RESIDENTIAL_LEASE,
      notes: 'Erstmietvertrag, unbefristet',
    },
  });

  // Contract 2: Anna Schmidt → Musterstraße Wohnung 2
  await prisma.contract.upsert({
    where: { id: 'seed-contract-anna-munich2' },
    update: {},
    create: {
      id: 'seed-contract-anna-munich2',
      unitId: munichApt2.id,
      tenantId: annaSchmidt.id,
      startDate: new Date('2023-06-01'),
      rentAmount: 1100,
      depositAmount: 2200,
      status: ContractStatus.ACTIVE,
      type: ContractType.RESIDENTIAL_LEASE,
      notes: 'Unbefristeter Mietvertrag',
    },
  });

  // Contract 3: Example GmbH → Berlin Ladenfläche EG
  await prisma.contract.upsert({
    where: { id: 'seed-contract-gmbh-berlin-commercial' },
    update: {},
    create: {
      id: 'seed-contract-gmbh-berlin-commercial',
      unitId: berlinCommercial.id,
      tenantId: exampleGmbH.id,
      startDate: new Date('2024-03-01'),
      rentAmount: 2400,
      depositAmount: 4800,
      status: ContractStatus.ACTIVE,
      type: ContractType.COMMERCIAL_LEASE,
      notes: 'Gewerberaummietvertrag, 5 Jahre',
    },
  });

  // Update occupied units
  await prisma.unit.update({
    where: { id: munichApt1.id },
    data: { status: 'OCCUPIED' },
  });
  await prisma.unit.update({
    where: { id: munichApt2.id },
    data: { status: 'OCCUPIED' },
  });
  await prisma.unit.update({
    where: { id: berlinCommercial.id },
    data: { status: 'OCCUPIED' },
  });

  // Vacant units: munichApt3, berlinAptA, berlinAptB stay VACANT
  void munichApt3;
  void berlinAptA;
  void berlinAptB;

  console.log('Created 3 contracts, set 3 units as OCCUPIED');
  console.log('Seed complete!');
  console.log('');
  console.log('Test credentials:');
  console.log('  Admin: admin@ix2.local / Admin1234!');
  console.log('  Manager: manager@ix2.local / Manager1234!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
