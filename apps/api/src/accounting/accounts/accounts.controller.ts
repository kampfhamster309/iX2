import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AccountsService } from './accounts.service';
import { AccountQueryDto } from './dto/account-query.dto';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/accounts')
export class AccountsController {
  constructor(private accounts: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all accounts' })
  findAll(@Query() query: AccountQueryDto) {
    return this.accounts.findAll(query.type, query.parentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single account' })
  findOne(@Param('id') id: string) {
    return this.accounts.findOne(id);
  }

  @Get(':id/balance')
  @ApiOperation({ summary: 'Get the running balance for an account' })
  getBalance(@Param('id') id: string) {
    return this.accounts.getBalance(id);
  }
}
