import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/invoices')
export class InvoicesController {
  constructor(private invoices: InvoicesService) {}

  @Post('generate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({
    summary: 'Generate draft invoices for all active contracts for a given month/year',
  })
  generate(@Body() dto: GenerateInvoicesDto, @CurrentUser() user: User) {
    return this.invoices.generateMonthlyInvoices(dto, user.id);
  }

  @Post(':id/issue')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Issue a draft invoice (posts journal entry)' })
  issue(@Param('id') id: string, @CurrentUser() user: User) {
    return this.invoices.issueInvoice(id, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List invoices (paginated, filterable)' })
  findAll(@Query() query: InvoiceQueryDto) {
    return this.invoices.findAll(query);
  }

  @Get('overdue/mark')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Mark all past-due issued invoices as OVERDUE' })
  markOverdue() {
    return this.invoices.markOverdue();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single invoice' })
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Post(':id/payments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @CurrentUser() user: User) {
    return this.invoices.recordPayment(id, dto, user.id);
  }
}
