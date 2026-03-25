import { Module } from '@nestjs/common';
import { AccountsController } from './accounts/accounts.controller';
import { AccountsService } from './accounts/accounts.service';
import { JournalController } from './journal/journal.controller';
import { JournalService } from './journal/journal.service';

@Module({
  controllers: [AccountsController, JournalController],
  providers: [AccountsService, JournalService],
  exports: [AccountsService, JournalService],
})
export class AccountingModule {}
