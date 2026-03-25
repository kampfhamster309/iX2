import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PostJournalEntryDto } from './dto/post-journal-entry.dto';
import { JournalQueryDto } from './dto/journal-query.dto';
import Decimal from 'decimal.js';

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}

  async post(dto: PostJournalEntryDto, createdById: string) {
    // Validate each line has exactly one non-zero side
    for (const line of dto.lines) {
      const debit = new Decimal(line.debit ?? 0);
      const credit = new Decimal(line.credit ?? 0);
      if (debit.isZero() && credit.isZero()) {
        throw new BadRequestException(
          `Journal line for account ${line.accountId} has both debit and credit as zero`,
        );
      }
      if (!debit.isZero() && !credit.isZero()) {
        throw new BadRequestException(
          `Journal line for account ${line.accountId} has both debit and credit non-zero. Each line must use only one side.`,
        );
      }
    }

    // Validate balanced entry: sum(debit) === sum(credit)
    const totalDebit = dto.lines.reduce(
      (sum, l) => sum.plus(new Decimal(l.debit ?? 0)),
      new Decimal(0),
    );
    const totalCredit = dto.lines.reduce(
      (sum, l) => sum.plus(new Decimal(l.credit ?? 0)),
      new Decimal(0),
    );

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is unbalanced: total debits (${totalDebit}) ≠ total credits (${totalCredit})`,
      );
    }

    // Verify all accounts exist
    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds } },
      select: { id: true },
    });
    if (accounts.length !== accountIds.length) {
      throw new BadRequestException('One or more account IDs do not exist');
    }

    // Persist atomically
    return this.prisma.journalEntry.create({
      data: {
        date: new Date(dto.date),
        description: dto.description,
        reference: dto.reference,
        propertyId: dto.propertyId,
        createdById,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            debit: new Decimal(l.debit ?? 0),
            credit: new Decimal(l.credit ?? 0),
            description: l.description,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  async findAll(query: JournalQueryDto) {
    const { page = 1, limit = 50, dateFrom, dateTo, accountId, propertyId } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }
    if (propertyId) where.propertyId = propertyId;
    if (accountId) {
      where.lines = { some: { accountId } };
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
