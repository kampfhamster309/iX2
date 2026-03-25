import { Module } from '@nestjs/common';
import { AccountsController } from './accounts/accounts.controller';
import { AccountsService } from './accounts/accounts.service';
import { JournalController } from './journal/journal.controller';
import { JournalService } from './journal/journal.service';
import { InvoicesController } from './invoices/invoices.controller';
import { InvoicesService } from './invoices/invoices.service';
import { ExpensesController } from './expenses/expenses.controller';
import { ExpensesService } from './expenses/expenses.service';
import { DepositsController } from './deposits/deposits.controller';
import { DepositsService } from './deposits/deposits.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';

@Module({
  controllers: [
    AccountsController,
    JournalController,
    InvoicesController,
    ExpensesController,
    DepositsController,
    ReportsController,
  ],
  providers: [
    AccountsService,
    JournalService,
    InvoicesService,
    ExpensesService,
    DepositsService,
    ReportsService,
  ],
  exports: [AccountsService, JournalService],
})
export class AccountingModule {}
