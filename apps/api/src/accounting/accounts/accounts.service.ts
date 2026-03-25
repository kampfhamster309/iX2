import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountType } from '@prisma/client';

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  findAll(type?: AccountType, parentId?: string) {
    return this.prisma.account.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(parentId !== undefined ? { parentId: parentId || null } : {}),
      },
      include: { children: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(id: string) {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { children: true, parent: true },
    });
    if (!account) throw new NotFoundException(`Account ${id} not found`);
    return account;
  }

  async getBalance(id: string) {
    await this.findOne(id); // ensure exists

    const result = await this.prisma.journalLine.aggregate({
      where: { accountId: id },
      _sum: { debit: true, credit: true },
    });

    const totalDebit = Number(result._sum.debit ?? 0);
    const totalCredit = Number(result._sum.credit ?? 0);

    return {
      accountId: id,
      totalDebit,
      totalCredit,
      // For ASSET and EXPENSE accounts, normal balance is debit (debit - credit)
      // For LIABILITY, EQUITY, INCOME accounts, normal balance is credit (credit - debit)
      balance: totalDebit - totalCredit,
    };
  }
}
