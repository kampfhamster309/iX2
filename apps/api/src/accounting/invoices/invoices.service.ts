import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { AccountsService } from '../accounts/accounts.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private journal: JournalService,
    private accounts: AccountsService,
  ) {}

  // ----------------------------------------------------------------
  // generateMonthlyInvoices
  // Creates DRAFT invoices for all ACTIVE contracts for the given
  // month/year. Idempotent — skips contracts that already have an
  // invoice for that period (enforced by the @@unique constraint).
  // Due date: 3rd of the given month.
  // ----------------------------------------------------------------
  async generateMonthlyInvoices(dto: GenerateInvoicesDto, _createdById: string) {
    const { month, year } = dto;

    const activeContracts = await this.prisma.contract.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, rentAmount: true },
    });

    const dueDate = new Date(year, month - 1, 3); // 3rd of the month

    const results = { created: 0, skipped: 0 };

    for (const contract of activeContracts) {
      try {
        await this.prisma.invoice.create({
          data: {
            contractId: contract.id,
            periodMonth: month,
            periodYear: year,
            amountDue: contract.rentAmount,
            dueDate,
          },
        });
        results.created++;
      } catch (e: unknown) {
        // Unique constraint violation = already exists → skip
        if ((e as { code?: string }).code === 'P2002') {
          results.skipped++;
        } else {
          throw e;
        }
      }
    }

    return results;
  }

  // ----------------------------------------------------------------
  // issueInvoice
  // Transitions DRAFT → ISSUED and posts the journal entry:
  //   DR Rent Receivable (1100) / CR Rental Income (4000)
  // ----------------------------------------------------------------
  async issueInvoice(id: string, createdById: string) {
    const invoice = await this.findOne(id);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(`Invoice is already ${invoice.status} and cannot be issued`);
    }

    // Resolve account IDs
    const [rentReceivable, rentalIncome] = await Promise.all([
      this.prisma.account.findUniqueOrThrow({ where: { code: '1100' }, select: { id: true } }),
      this.prisma.account.findUniqueOrThrow({ where: { code: '4000' }, select: { id: true } }),
    ]);

    const contract = await this.prisma.contract.findUniqueOrThrow({
      where: { id: invoice.contractId },
      select: { unit: { select: { propertyId: true } } },
    });

    const amount = Number(invoice.amountDue);

    const entry = await this.journal.post(
      {
        date: new Date().toISOString().split('T')[0],
        description: `Rent invoice ${invoice.periodYear}-${String(invoice.periodMonth).padStart(2, '0')} — contract ${invoice.contractId}`,
        reference: invoice.id,
        propertyId: contract.unit.propertyId,
        lines: [
          { accountId: rentReceivable.id, debit: amount, credit: 0 },
          { accountId: rentalIncome.id, debit: 0, credit: amount },
        ],
      },
      createdById,
    );

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.ISSUED,
        issuedAt: new Date(),
        journalEntryId: entry.id,
      },
    });
  }

  // ----------------------------------------------------------------
  // recordPayment
  // Records a payment against an invoice and posts:
  //   DR Bank (1000) / CR Rent Receivable (1100)
  // Updates invoice status: PAID / PARTIALLY_PAID.
  // Rejects overpayment.
  // ----------------------------------------------------------------
  async recordPayment(invoiceId: string, dto: RecordPaymentDto, createdById: string) {
    const invoice = await this.findOne(invoiceId);

    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Cannot record payment on a ${invoice.status} invoice`);
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Invoice must be issued before recording a payment');
    }

    const newAmountPaid = new Decimal(invoice.amountPaid).plus(dto.amount);
    const amountDue = new Decimal(invoice.amountDue);

    if (newAmountPaid.greaterThan(amountDue)) {
      throw new BadRequestException(
        `Payment of ${dto.amount} would exceed the amount due (${amountDue}). Overpayments are not accepted.`,
      );
    }

    // Resolve account IDs
    const [bank, rentReceivable] = await Promise.all([
      this.prisma.account.findUniqueOrThrow({ where: { code: '1000' }, select: { id: true } }),
      this.prisma.account.findUniqueOrThrow({ where: { code: '1100' }, select: { id: true } }),
    ]);

    const contract = await this.prisma.contract.findUniqueOrThrow({
      where: { id: invoice.contractId },
      select: { unit: { select: { propertyId: true } } },
    });

    // Post journal entry
    const entry = await this.journal.post(
      {
        date: dto.paymentDate,
        description: `Payment received — invoice ${invoiceId}`,
        reference: dto.reference,
        propertyId: contract.unit.propertyId,
        lines: [
          { accountId: bank.id, debit: dto.amount, credit: 0 },
          { accountId: rentReceivable.id, debit: 0, credit: dto.amount },
        ],
      },
      createdById,
    );

    // Determine new status
    const newStatus = newAmountPaid.equals(amountDue)
      ? InvoiceStatus.PAID
      : InvoiceStatus.PARTIALLY_PAID;

    // Create payment record and update invoice atomically
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          invoiceId,
          amount: dto.amount,
          paymentDate: new Date(dto.paymentDate),
          method: dto.method ?? PaymentMethod.BANK_TRANSFER,
          reference: dto.reference,
          journalEntryId: entry.id,
        },
      }),
      this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid: newAmountPaid.toFixed(2), status: newStatus },
      }),
    ]);

    return payment;
  }

  // ----------------------------------------------------------------
  // markOverdue
  // Marks all ISSUED invoices whose dueDate is in the past as OVERDUE.
  // Intended to be called by a scheduled job (future) or manually.
  // ----------------------------------------------------------------
  async markOverdue() {
    const result = await this.prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.ISSUED,
        dueDate: { lt: new Date() },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
    return { updated: result.count };
  }

  // ----------------------------------------------------------------
  // findAll — paginated, filterable
  // ----------------------------------------------------------------
  async findAll(query: InvoiceQueryDto) {
    const { page = 1, limit = 50, status, contractId, propertyId, tenantId } = query;
    const skip = (page - 1) * limit;

    // Build where clause — propertyId and tenantId require joining through contracts
    // Since contractId is a plain string (no Prisma relation), we need to resolve
    // the matching contractIds first if propertyId or tenantId filter is applied
    let contractIds: string[] | undefined;

    if (propertyId || tenantId) {
      const contracts = await this.prisma.contract.findMany({
        where: {
          ...(propertyId ? { unit: { propertyId } } : {}),
          ...(tenantId ? { tenantId } : {}),
        },
        select: { id: true },
      });
      contractIds = contracts.map((c) => c.id);
      if (contractIds.length === 0) return { data: [], total: 0, page, limit };
    }

    const where: Record<string, unknown> = {
      ...(status ? { status } : {}),
      ...(contractId ? { contractId } : {}),
      ...(contractIds ? { contractId: { in: contractIds } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        include: { payments: true },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`);
    return invoice;
  }
}
