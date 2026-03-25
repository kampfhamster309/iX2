import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@ApiTags('Accounting — Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounting/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('trial-balance')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Trial balance — all accounts with debit/credit totals' })
  trialBalance(@Query() query: ReportQueryDto) {
    return this.reports.trialBalance(query);
  }

  @Get('profit-loss')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Income Statement (P&L)' })
  profitAndLoss(@Query() query: ReportQueryDto) {
    return this.reports.profitAndLoss(query);
  }

  @Get('balance-sheet')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Balance Sheet — assets, liabilities, equity' })
  balanceSheet(@Query() query: ReportQueryDto) {
    return this.reports.balanceSheet(query);
  }

  @Get('rent-roll')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Rent roll — active contracts with outstanding balances and deposits' })
  rentRoll(@Query() query: ReportQueryDto) {
    return this.reports.rentRoll(query);
  }

  @Get('cash-flow')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Cash flow summary — cash in vs out per period' })
  cashFlow(@Query() query: ReportQueryDto) {
    return this.reports.cashFlow(query);
  }

  @Get('rent-roll/pdf')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'Rent roll PDF export' })
  async rentRollPdf(@Query() query: ReportQueryDto, @Res() reply: FastifyReply) {
    const buffer = await this.reports.rentRollPdf(query);
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="rent-roll.pdf"')
      .send(buffer);
  }

  @Get('profit-loss/pdf')
  @Roles('ADMIN', 'ACCOUNTANT', 'MANAGER')
  @ApiOperation({ summary: 'P&L PDF export' })
  async profitAndLossPdf(@Query() query: ReportQueryDto, @Res() reply: FastifyReply) {
    const buffer = await this.reports.profitAndLossPdf(query);
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="profit-loss.pdf"')
      .send(buffer);
  }
}
