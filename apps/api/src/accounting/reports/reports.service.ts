import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { AccountType } from '@prisma/client';
import Decimal from 'decimal.js';
import PDFDocument from 'pdfkit';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dateFilter(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;
  return {
    ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
    ...(dateTo ? { lte: new Date(dateTo) } : {}),
  };
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  return new Decimal(String(v)).toNumber();
}

async function bufferFromDoc(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// ReportsService
// ---------------------------------------------------------------------------

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Trial Balance
  // -------------------------------------------------------------------------
  async trialBalance(query: ReportQueryDto) {
    const { dateFrom, dateTo, propertyId } = query;
    const entryWhere: Record<string, unknown> = {};
    if (propertyId) entryWhere.propertyId = propertyId;
    const dFilter = dateFilter(dateFrom, dateTo);
    if (dFilter) entryWhere.date = dFilter;

    const accounts = await this.prisma.account.findMany({
      orderBy: { code: 'asc' },
      include: {
        journalLines: {
          where: { journalEntry: entryWhere },
        },
      },
    });

    let grandDebit = new Decimal(0);
    let grandCredit = new Decimal(0);

    const rows = accounts.map((acc) => {
      const totalDebit = acc.journalLines.reduce(
        (s, l) => s.plus(new Decimal(String(l.debit))),
        new Decimal(0),
      );
      const totalCredit = acc.journalLines.reduce(
        (s, l) => s.plus(new Decimal(String(l.credit))),
        new Decimal(0),
      );
      grandDebit = grandDebit.plus(totalDebit);
      grandCredit = grandCredit.plus(totalCredit);
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        nameDe: acc.nameDe,
        type: acc.type,
        totalDebit: totalDebit.toNumber(),
        totalCredit: totalCredit.toNumber(),
        netBalance: totalDebit.minus(totalCredit).toNumber(),
      };
    });

    return {
      rows,
      grandTotalDebit: grandDebit.toNumber(),
      grandTotalCredit: grandCredit.toNumber(),
      isBalanced: grandDebit.equals(grandCredit),
    };
  }

  // -------------------------------------------------------------------------
  // P&L — Income Statement
  // -------------------------------------------------------------------------
  async profitAndLoss(query: ReportQueryDto) {
    const { dateFrom, dateTo, propertyId } = query;
    const entryWhere: Record<string, unknown> = {};
    if (propertyId) entryWhere.propertyId = propertyId;
    const dFilter = dateFilter(dateFrom, dateTo);
    if (dFilter) entryWhere.date = dFilter;

    const accounts = await this.prisma.account.findMany({
      where: { type: { in: [AccountType.INCOME, AccountType.EXPENSE] } },
      orderBy: { code: 'asc' },
      include: {
        journalLines: {
          where: { journalEntry: entryWhere },
        },
      },
    });

    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);
    const incomeRows: ReturnType<typeof buildRow>[] = [];
    const expenseRows: ReturnType<typeof buildRow>[] = [];

    function buildRow(acc: (typeof accounts)[number]) {
      const debit = acc.journalLines.reduce(
        (s, l) => s.plus(new Decimal(String(l.debit))),
        new Decimal(0),
      );
      const credit = acc.journalLines.reduce(
        (s, l) => s.plus(new Decimal(String(l.credit))),
        new Decimal(0),
      );
      const amount =
        acc.type === AccountType.INCOME
          ? credit.minus(debit) // normal credit balance
          : debit.minus(credit); // normal debit balance
      return {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        nameDe: acc.nameDe,
        amount: amount.toNumber(),
      };
    }

    for (const acc of accounts) {
      const row = buildRow(acc);
      if (acc.type === AccountType.INCOME) {
        incomeRows.push(row);
        totalIncome = totalIncome.plus(new Decimal(row.amount));
      } else {
        expenseRows.push(row);
        totalExpense = totalExpense.plus(new Decimal(row.amount));
      }
    }

    return {
      income: incomeRows,
      expenses: expenseRows,
      totalIncome: totalIncome.toNumber(),
      totalExpenses: totalExpense.toNumber(),
      netIncome: totalIncome.minus(totalExpense).toNumber(),
    };
  }

  // -------------------------------------------------------------------------
  // Balance Sheet
  // -------------------------------------------------------------------------
  async balanceSheet(query: ReportQueryDto) {
    const { dateFrom, dateTo, propertyId } = query;
    const entryWhere: Record<string, unknown> = {};
    if (propertyId) entryWhere.propertyId = propertyId;
    const dFilter = dateFilter(dateFrom, dateTo);
    if (dFilter) entryWhere.date = dFilter;

    const accounts = await this.prisma.account.findMany({
      where: { type: { in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY] } },
      orderBy: { code: 'asc' },
      include: {
        journalLines: {
          where: { journalEntry: entryWhere },
        },
      },
    });

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let totalEquity = new Decimal(0);
    const assetRows: {
      accountId: string;
      code: string;
      name: string;
      nameDe: string;
      balance: number;
    }[] = [];
    const liabilityRows: typeof assetRows = [];
    const equityRows: typeof assetRows = [];

    for (const acc of accounts) {
      const debit = acc.journalLines.reduce(
        (s, l) => s.plus(new Decimal(String(l.debit))),
        new Decimal(0),
      );
      const credit = acc.journalLines.reduce(
        (s, l) => s.plus(new Decimal(String(l.credit))),
        new Decimal(0),
      );
      const row = {
        accountId: acc.id,
        code: acc.code,
        name: acc.name,
        nameDe: acc.nameDe,
        // Assets: normal debit balance; Liabilities/Equity: normal credit balance
        balance:
          acc.type === AccountType.ASSET
            ? debit.minus(credit).toNumber()
            : credit.minus(debit).toNumber(),
      };
      if (acc.type === AccountType.ASSET) {
        assetRows.push(row);
        totalAssets = totalAssets.plus(new Decimal(row.balance));
      } else if (acc.type === AccountType.LIABILITY) {
        liabilityRows.push(row);
        totalLiabilities = totalLiabilities.plus(new Decimal(row.balance));
      } else {
        equityRows.push(row);
        totalEquity = totalEquity.plus(new Decimal(row.balance));
      }
    }

    return {
      assets: assetRows,
      liabilities: liabilityRows,
      equity: equityRows,
      totalAssets: totalAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      totalEquity: totalEquity.toNumber(),
      // The accounting equation: Assets = Liabilities + Equity
      isBalanced: totalAssets.equals(totalLiabilities.plus(totalEquity)),
    };
  }

  // -------------------------------------------------------------------------
  // Rent Roll
  // -------------------------------------------------------------------------
  async rentRoll(query: ReportQueryDto) {
    const { propertyId } = query;

    const contracts = await this.prisma.contract.findMany({
      where: {
        status: 'ACTIVE',
        ...(propertyId ? { unit: { propertyId } } : {}),
      },
      include: {
        tenant: {
          select: { id: true, firstName: true, lastName: true, companyName: true, isCompany: true },
        },
        unit: {
          include: { property: { select: { id: true, name: true, address: true } } },
        },
      },
      orderBy: [{ unit: { property: { name: 'asc' } } }, { unit: { name: 'asc' } }],
    });

    const rows = await Promise.all(
      contracts.map(async (c) => {
        // Outstanding balance: sum of amountDue - amountPaid for non-CANCELLED invoices
        const invoiceAgg = await this.prisma.invoice.aggregate({
          where: {
            contractId: c.id,
            status: { notIn: ['CANCELLED'] },
          },
          _sum: { amountDue: true, amountPaid: true },
        });
        const amountDue = toNum(invoiceAgg._sum.amountDue);
        const amountPaid = toNum(invoiceAgg._sum.amountPaid);
        const outstanding = new Decimal(amountDue).minus(new Decimal(amountPaid)).toNumber();

        // Deposit held
        const depositAgg = await this.prisma.securityDeposit.aggregate({
          where: { contractId: c.id, status: { notIn: ['FULLY_RETURNED', 'FORFEITED'] } },
          _sum: { amount: true },
        });
        const depositHeld = toNum(depositAgg._sum.amount);

        const tenantName = c.tenant.isCompany
          ? (c.tenant.companyName ?? `${c.tenant.firstName} ${c.tenant.lastName}`)
          : `${c.tenant.firstName} ${c.tenant.lastName}`;

        return {
          contractId: c.id,
          property: c.unit.property,
          unit: { id: c.unit.id, name: c.unit.name, type: c.unit.type },
          tenantId: c.tenant.id,
          tenantName,
          startDate: c.startDate,
          endDate: c.endDate,
          rentAmount: toNum(c.rentAmount),
          depositAmount: toNum(c.depositAmount ?? 0),
          outstandingBalance: outstanding,
          depositHeld,
        };
      }),
    );

    return { rows, count: rows.length };
  }

  // -------------------------------------------------------------------------
  // Cash Flow Summary
  // -------------------------------------------------------------------------
  async cashFlow(query: ReportQueryDto) {
    const { dateFrom, dateTo, propertyId } = query;
    const entryWhere: Record<string, unknown> = {};
    if (propertyId) entryWhere.propertyId = propertyId;
    const dFilter = dateFilter(dateFrom, dateTo);
    if (dFilter) entryWhere.date = dFilter;

    // Find Bank account (code 1000)
    const bankAccount = await this.prisma.account.findUnique({
      where: { code: '1000' },
      select: { id: true },
    });
    if (!bankAccount) {
      return { cashIn: 0, cashOut: 0, netCashFlow: 0, entries: [] };
    }

    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: bankAccount.id,
        journalEntry: entryWhere,
      },
      include: {
        journalEntry: {
          select: { id: true, date: true, description: true, reference: true, propertyId: true },
        },
      },
      orderBy: { journalEntry: { date: 'asc' } },
    });

    let cashIn = new Decimal(0);
    let cashOut = new Decimal(0);
    const entries = lines.map((l) => {
      const debit = new Decimal(String(l.debit));
      const credit = new Decimal(String(l.credit));
      cashIn = cashIn.plus(debit); // DR Bank = cash received
      cashOut = cashOut.plus(credit); // CR Bank = cash paid out
      return {
        date: l.journalEntry.date,
        description: l.journalEntry.description,
        reference: l.journalEntry.reference,
        propertyId: l.journalEntry.propertyId,
        cashIn: debit.toNumber(),
        cashOut: credit.toNumber(),
      };
    });

    return {
      cashIn: cashIn.toNumber(),
      cashOut: cashOut.toNumber(),
      netCashFlow: cashIn.minus(cashOut).toNumber(),
      entries,
    };
  }

  // -------------------------------------------------------------------------
  // PDF: Rent Roll
  // -------------------------------------------------------------------------
  async rentRollPdf(query: ReportQueryDto): Promise<Buffer> {
    const { rows } = await this.rentRoll(query);

    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const pdfPromise = bufferFromDoc(doc);

    const pageWidth = doc.page.width - 80; // margins

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('Rent Roll', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generated: ${new Date().toISOString().slice(0, 10)}`, {
        align: 'center',
      });
    doc.moveDown();

    // Column widths
    const colWidths = [120, 80, 100, 80, 70, 80, 80];
    const headers = ['Property', 'Unit', 'Tenant', 'Rent/mo', 'Start', 'Outstanding', 'Deposit'];

    // Table header
    doc.fontSize(9).font('Helvetica-Bold');
    let x = 40;
    headers.forEach((h, i) => {
      doc.text(h, x, doc.y, { width: colWidths[i], lineBreak: false });
      x += colWidths[i];
    });
    doc.moveDown(0.3);
    doc
      .moveTo(40, doc.y)
      .lineTo(40 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.3);

    // Table rows
    doc.font('Helvetica').fontSize(8);
    for (const row of rows) {
      const y = doc.y;
      const cols = [
        row.property.name,
        row.unit.name,
        row.tenantName,
        row.rentAmount.toFixed(2),
        row.startDate.toISOString().slice(0, 10),
        row.outstandingBalance.toFixed(2),
        row.depositHeld.toFixed(2),
      ];
      x = 40;
      cols.forEach((c, i) => {
        doc.text(c, x, y, { width: colWidths[i], lineBreak: false });
        x += colWidths[i];
      });
      doc.moveDown(0.6);
    }

    // Totals
    doc.moveDown(0.3);
    doc
      .moveTo(40, doc.y)
      .lineTo(40 + pageWidth, doc.y)
      .stroke();
    doc.moveDown(0.3);
    const totalRent = rows.reduce((s, r) => s + r.rentAmount, 0);
    const totalOutstanding = rows.reduce((s, r) => s + r.outstandingBalance, 0);
    const totalDeposit = rows.reduce((s, r) => s + r.depositHeld, 0);
    doc.font('Helvetica-Bold').fontSize(8);
    const totalsY = doc.y;
    doc.text(`Total (${rows.length} units)`, 40, totalsY, {
      width: colWidths[0] + colWidths[1] + colWidths[2],
      lineBreak: false,
    });
    const rentX = 40 + colWidths[0] + colWidths[1] + colWidths[2];
    doc.text(totalRent.toFixed(2), rentX, totalsY, { width: colWidths[3], lineBreak: false });
    const outX = rentX + colWidths[3] + colWidths[4];
    doc.text(totalOutstanding.toFixed(2), outX, totalsY, { width: colWidths[5], lineBreak: false });
    doc.text(totalDeposit.toFixed(2), outX + colWidths[5], totalsY, {
      width: colWidths[6],
      lineBreak: false,
    });

    doc.end();
    return pdfPromise;
  }

  // -------------------------------------------------------------------------
  // PDF: P&L
  // -------------------------------------------------------------------------
  async profitAndLossPdf(query: ReportQueryDto): Promise<Buffer> {
    const report = await this.profitAndLoss(query);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const pdfPromise = bufferFromDoc(doc);

    const pageWidth = doc.page.width - 80;

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text('Income Statement (P&L)', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .text(`Generated: ${new Date().toISOString().slice(0, 10)}`, {
        align: 'center',
      });
    if (query.dateFrom || query.dateTo) {
      const period = `${query.dateFrom ?? ''} — ${query.dateTo ?? ''}`;
      doc.text(`Period: ${period}`, { align: 'center' });
    }
    doc.moveDown();

    const colLeft = 40;
    const colRight = doc.page.width - 40 - 100;

    function sectionHeader(title: string) {
      doc.font('Helvetica-Bold').fontSize(11).text(title, colLeft);
      doc.moveDown(0.3);
      doc
        .moveTo(colLeft, doc.y)
        .lineTo(colLeft + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.3);
    }

    function tableRow(label: string, amount: number, indent = false) {
      const y = doc.y;
      doc
        .font('Helvetica')
        .fontSize(9)
        .text(indent ? `  ${label}` : label, colLeft, y, {
          width: colRight - colLeft,
          lineBreak: false,
        });
      doc.font('Helvetica').fontSize(9).text(amount.toFixed(2), colRight, y, {
        width: 100,
        align: 'right',
        lineBreak: false,
      });
      doc.moveDown(0.5);
    }

    function totalRow(label: string, amount: number) {
      doc.font('Helvetica-Bold').fontSize(9);
      const y = doc.y;
      doc.text(label, colLeft, y, { width: colRight - colLeft, lineBreak: false });
      doc.text(amount.toFixed(2), colRight, y, { width: 100, align: 'right', lineBreak: false });
      doc.moveDown(0.3);
      doc
        .moveTo(colLeft, doc.y)
        .lineTo(colLeft + pageWidth, doc.y)
        .stroke();
      doc.moveDown(0.5);
    }

    // Income section
    sectionHeader('Income');
    for (const row of report.income) {
      tableRow(`${row.code} ${row.name}`, row.amount, true);
    }
    totalRow('Total Income', report.totalIncome);

    // Expense section
    sectionHeader('Expenses');
    for (const row of report.expenses) {
      tableRow(`${row.code} ${row.name}`, row.amount, true);
    }
    totalRow('Total Expenses', report.totalExpenses);

    // Net Income
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(11);
    const netY = doc.y;
    doc.text('Net Income', colLeft, netY, { width: colRight - colLeft, lineBreak: false });
    doc.text(report.netIncome.toFixed(2), colRight, netY, {
      width: 100,
      align: 'right',
      lineBreak: false,
    });

    doc.end();
    return pdfPromise;
  }
}
