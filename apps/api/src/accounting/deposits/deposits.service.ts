import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DepositStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalService } from '../journal/journal.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreateDeductionDto } from './dto/create-deduction.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { DepositQueryDto } from './dto/deposit-query.dto';

@Injectable()
export class DepositsService {
  constructor(
    private prisma: PrismaService,
    private journal: JournalService,
  ) {}

  async recordDeposit(dto: CreateDepositDto, createdById: string) {
    // Verify the contract exists
    await this.prisma.contract.findUniqueOrThrow({ where: { id: dto.contractId } });

    // Check no deposit already exists for this contractId
    const existing = await this.prisma.securityDeposit.findFirst({
      where: { contractId: dto.contractId },
    });
    if (existing) {
      throw new ConflictException(`A deposit already exists for contract ${dto.contractId}`);
    }

    // Resolve bank and security deposits payable accounts
    const [bank, securityDepositsPayable] = await Promise.all([
      this.prisma.account.findUniqueOrThrow({ where: { code: '1000' }, select: { id: true } }),
      this.prisma.account.findUniqueOrThrow({ where: { code: '2000' }, select: { id: true } }),
    ]);

    const amount = new Decimal(dto.amount);

    // Post journal entry: DR Bank (1000) / CR Security Deposits Payable (2000)
    const entry = await this.journal.post(
      {
        date: dto.receivedDate,
        description: `Security deposit received for contract ${dto.contractId}`,
        propertyId: dto.propertyId,
        lines: [
          { accountId: bank.id, debit: amount.toNumber(), credit: 0 },
          { accountId: securityDepositsPayable.id, debit: 0, credit: amount.toNumber() },
        ],
      },
      createdById,
    );

    // Create SecurityDeposit record
    const deposit = await this.prisma.securityDeposit.create({
      data: {
        contractId: dto.contractId,
        propertyId: dto.propertyId,
        amount: dto.amount,
        receivedDate: new Date(dto.receivedDate),
        status: DepositStatus.HELD,
        journalEntryId: entry.id,
        createdById,
      },
      include: { deductions: true, refunds: true },
    });

    return deposit;
  }

  async addDeduction(depositId: string, dto: CreateDeductionDto, createdById: string) {
    const deposit = await this.prisma.securityDeposit.findUnique({
      where: { id: depositId },
      include: { deductions: true, refunds: true },
    });
    if (!deposit) throw new NotFoundException(`Deposit ${depositId} not found`);

    if (
      deposit.status === DepositStatus.FULLY_RETURNED ||
      deposit.status === DepositStatus.FORFEITED
    ) {
      throw new BadRequestException(
        `Cannot add deduction to a deposit with status ${deposit.status}`,
      );
    }

    // Calculate remaining balance
    const totalDeductions = deposit.deductions.reduce((s, d) => s.plus(d.amount), new Decimal(0));
    const totalRefunds = deposit.refunds.reduce((s, r) => s.plus(r.amount), new Decimal(0));
    const remaining = new Decimal(deposit.amount).minus(totalDeductions).minus(totalRefunds);

    if (new Decimal(dto.amount).greaterThan(remaining)) {
      throw new BadRequestException('Deduction exceeds remaining deposit balance');
    }

    // Validate accountId exists
    const account = await this.prisma.account.findUnique({ where: { id: dto.accountId } });
    if (!account) throw new NotFoundException(`Account ${dto.accountId} not found`);

    // Resolve security deposits payable account
    const securityDepositsPayable = await this.prisma.account.findUniqueOrThrow({
      where: { code: '2000' },
      select: { id: true },
    });

    const amount = new Decimal(dto.amount);

    // Post journal entry: DR Security Deposits Payable (2000) / CR [dto.accountId]
    const entry = await this.journal.post(
      {
        date: new Date().toISOString(),
        description: `Security deposit deduction — ${dto.reason}`,
        propertyId: deposit.propertyId,
        lines: [
          { accountId: securityDepositsPayable.id, debit: amount.toNumber(), credit: 0 },
          { accountId: dto.accountId, debit: 0, credit: amount.toNumber() },
        ],
      },
      createdById,
    );

    // Create DepositDeduction
    await this.prisma.depositDeduction.create({
      data: {
        depositId,
        amount: dto.amount,
        reason: dto.reason,
        accountId: dto.accountId,
        expenseId: dto.expenseId,
        journalEntryId: entry.id,
      },
    });

    // Recalculate status
    await this.recalcStatus(depositId);

    return this.findOne(depositId);
  }

  async addRefund(depositId: string, dto: CreateRefundDto, createdById: string) {
    const deposit = await this.prisma.securityDeposit.findUnique({
      where: { id: depositId },
      include: { deductions: true, refunds: true },
    });
    if (!deposit) throw new NotFoundException(`Deposit ${depositId} not found`);

    if (
      deposit.status === DepositStatus.FULLY_RETURNED ||
      deposit.status === DepositStatus.FORFEITED
    ) {
      throw new BadRequestException(`Cannot add refund to a deposit with status ${deposit.status}`);
    }

    // Calculate remaining balance
    const totalDeductions = deposit.deductions.reduce((s, d) => s.plus(d.amount), new Decimal(0));
    const totalRefunds = deposit.refunds.reduce((s, r) => s.plus(r.amount), new Decimal(0));
    const remaining = new Decimal(deposit.amount).minus(totalDeductions).minus(totalRefunds);

    if (new Decimal(dto.amount).greaterThan(remaining)) {
      throw new BadRequestException('Refund exceeds remaining deposit balance');
    }

    // Resolve bank and security deposits payable accounts
    const [bank, securityDepositsPayable] = await Promise.all([
      this.prisma.account.findUniqueOrThrow({ where: { code: '1000' }, select: { id: true } }),
      this.prisma.account.findUniqueOrThrow({ where: { code: '2000' }, select: { id: true } }),
    ]);

    const amount = new Decimal(dto.amount);

    // Post journal entry: DR Security Deposits Payable (2000) / CR Bank (1000)
    const entry = await this.journal.post(
      {
        date: dto.refundDate,
        description: `Security deposit refund for contract ${deposit.contractId}`,
        reference: dto.reference,
        propertyId: deposit.propertyId,
        lines: [
          { accountId: securityDepositsPayable.id, debit: amount.toNumber(), credit: 0 },
          { accountId: bank.id, debit: 0, credit: amount.toNumber() },
        ],
      },
      createdById,
    );

    // Create DepositRefund
    await this.prisma.depositRefund.create({
      data: {
        depositId,
        amount: dto.amount,
        refundDate: new Date(dto.refundDate),
        reference: dto.reference,
        journalEntryId: entry.id,
      },
    });

    // Recalculate status
    await this.recalcStatus(depositId);

    return this.findOne(depositId);
  }

  private async recalcStatus(depositId: string): Promise<void> {
    const deposit = await this.prisma.securityDeposit.findUniqueOrThrow({
      where: { id: depositId },
      include: { deductions: true, refunds: true },
    });

    const total = new Decimal(deposit.amount);
    const returned = deposit.deductions
      .reduce((s, d) => s.plus(d.amount), new Decimal(0))
      .plus(deposit.refunds.reduce((s, r) => s.plus(r.amount), new Decimal(0)));

    let status: DepositStatus;
    if (returned.equals(0)) status = DepositStatus.HELD;
    else if (returned.equals(total)) status = DepositStatus.FULLY_RETURNED;
    else status = DepositStatus.PARTIALLY_RETURNED;

    await this.prisma.securityDeposit.update({ where: { id: depositId }, data: { status } });
  }

  async findAll(query: DepositQueryDto) {
    const { page = 1, limit = 50, status, contractId, propertyId } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      ...(status ? { status } : {}),
      ...(contractId ? { contractId } : {}),
      ...(propertyId ? { propertyId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.securityDeposit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { deductions: true, refunds: true },
      }),
      this.prisma.securityDeposit.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const deposit = await this.prisma.securityDeposit.findUnique({
      where: { id },
      include: { deductions: true, refunds: true },
    });
    if (!deposit) throw new NotFoundException(`Deposit ${id} not found`);
    return deposit;
  }
}
