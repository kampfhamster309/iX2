import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { StorageService } from '../../storage/storage.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { AccountType } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private journal: JournalService,
    private storage: StorageService,
  ) {}

  async create(
    dto: CreateExpenseDto,
    createdById: string,
    receiptBuffer?: Buffer,
    receiptName?: string,
  ) {
    // Validate account is EXPENSE type
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException(`Account ${dto.accountId} not found`);
    if (account.type !== AccountType.EXPENSE) {
      throw new BadRequestException(`Account ${account.code} is not an EXPENSE account`);
    }

    // Validate dueDate required for unpaid expenses
    if (dto.isPaid === false && !dto.dueDate) {
      throw new BadRequestException('dueDate is required for unpaid expenses');
    }

    // Save receipt if provided
    let receiptPath: string | undefined;
    if (receiptBuffer && receiptName) {
      receiptPath = await this.storage.save(receiptBuffer, receiptName, 'receipts');
    }

    const amount = new Decimal(dto.amount);
    const isPaid = dto.isPaid !== false; // default true

    // Resolve counterpart account
    const counterpartCode = isPaid ? '1000' : '2200'; // Bank or Accounts Payable
    const counterpart = await this.prisma.account.findUniqueOrThrow({
      where: { code: counterpartCode },
      select: { id: true },
    });

    // Post journal entry
    const entry = await this.journal.post(
      {
        date: dto.date,
        description: `${dto.description}${dto.vendor ? ` — ${dto.vendor}` : ''}`,
        propertyId: dto.propertyId,
        lines: [
          { accountId: dto.accountId, debit: amount.toNumber(), credit: 0 },
          { accountId: counterpart.id, debit: 0, credit: amount.toNumber() },
        ],
      },
      createdById,
    );

    // Create expense (and optionally payable) in a transaction
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          propertyId: dto.propertyId,
          unitId: dto.unitId,
          accountId: dto.accountId,
          amount: dto.amount,
          date: new Date(dto.date),
          vendor: dto.vendor,
          description: dto.description,
          receiptPath,
          isPaid,
          maintenanceTaskId: dto.maintenanceTaskId,
          journalEntryId: entry.id,
          createdById,
        },
        include: { account: true },
      });

      if (!isPaid) {
        await tx.payable.create({
          data: {
            expenseId: expense.id,
            dueDate: new Date(dto.dueDate!),
          },
        });
      }

      return tx.expense.findUniqueOrThrow({
        where: { id: expense.id },
        include: { account: true, payable: true },
      });
    });
  }

  async pay(expenseId: string, dto: PayExpenseDto, createdById: string) {
    const expense = await this.findOne(expenseId);

    if (expense.isPaid) {
      throw new BadRequestException('Expense is already paid');
    }
    if (!expense.payable) {
      throw new BadRequestException('No payable found for this expense');
    }
    if (expense.payable.status === 'PAID') {
      throw new BadRequestException('Payable is already paid');
    }

    // Post journal entry: DR Accounts Payable / CR Bank
    const [accountsPayable, bank] = await Promise.all([
      this.prisma.account.findUniqueOrThrow({ where: { code: '2200' }, select: { id: true } }),
      this.prisma.account.findUniqueOrThrow({ where: { code: '1000' }, select: { id: true } }),
    ]);

    const entry = await this.journal.post(
      {
        date: dto.paymentDate,
        description: `Payment of payable — ${expense.description}`,
        reference: dto.reference,
        propertyId: expense.propertyId,
        lines: [
          { accountId: accountsPayable.id, debit: Number(expense.amount), credit: 0 },
          { accountId: bank.id, debit: 0, credit: Number(expense.amount) },
        ],
      },
      createdById,
    );

    await this.prisma.$transaction([
      this.prisma.payable.update({
        where: { id: expense.payable.id },
        data: { status: 'PAID', paidAt: new Date(dto.paymentDate), journalEntryId: entry.id },
      }),
      this.prisma.expense.update({
        where: { id: expenseId },
        data: { isPaid: true },
      }),
    ]);

    return this.findOne(expenseId);
  }

  async findAll(query: ExpenseQueryDto) {
    const { page = 1, limit = 50, propertyId, accountId, dateFrom, dateTo, isPaid } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(propertyId ? { propertyId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(isPaid !== undefined ? { isPaid } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: { account: true, payable: true },
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { account: true, payable: true },
    });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  async attachReceipt(id: string, buffer: Buffer, filename: string) {
    const expense = await this.findOne(id);
    if (expense.receiptPath) {
      this.storage.delete(expense.receiptPath);
    }
    const receiptPath = await this.storage.save(buffer, filename, 'receipts');
    return this.prisma.expense.update({
      where: { id },
      data: { receiptPath },
      include: { account: true, payable: true },
    });
  }

  getReceiptPath(expense: { receiptPath: string | null }): string | null {
    if (!expense.receiptPath) return null;
    return this.storage.resolve(expense.receiptPath);
  }

  getReceiptRelativePath(expense: { receiptPath: string | null }): string | null {
    return expense.receiptPath ?? null;
  }
}
