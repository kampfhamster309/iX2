import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import type { FastifyReply, FastifyRequest } from '@nestjs/platform-fastify/node_modules/fastify';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/expenses')
export class ExpensesController {
  constructor(private expenses: ExpensesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Create an expense (JSON body)' })
  async create(@Body() dto: CreateExpenseDto, @CurrentUser() user: User) {
    return this.expenses.create(dto, user.id);
  }

  @Post(':id/receipt')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Upload a receipt for an expense' })
  @ApiConsumes('multipart/form-data')
  async uploadReceipt(
    @Param('id') id: string,
    @Req() req: FastifyRequest,
    @CurrentUser() _user: User,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (req as any).file();
    if (!data) throw new BadRequestException('No file provided');
    const buffer = await data.toBuffer();
    return this.expenses.attachReceipt(id, buffer, data.filename);
  }

  @Get()
  @ApiOperation({ summary: 'List expenses (paginated, filterable)' })
  findAll(@Query() query: ExpenseQueryDto) {
    return this.expenses.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single expense' })
  findOne(@Param('id') id: string) {
    return this.expenses.findOne(id);
  }

  @Get(':id/receipt')
  @ApiOperation({ summary: 'Download receipt file for an expense' })
  async getReceipt(@Param('id') id: string, @Res() res: FastifyReply) {
    const expense = await this.expenses.findOne(id);
    const relativePath = this.expenses.getReceiptRelativePath(expense);
    if (!relativePath) {
      throw new NotFoundException('No receipt attached');
    }
    // sendFile uses path relative to the registered static root
    return (res as unknown as { sendFile: (path: string) => Promise<void> }).sendFile(relativePath);
  }

  @Post(':id/pay')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Pay an unpaid expense (clears the payable)' })
  pay(@Param('id') id: string, @Body() dto: PayExpenseDto, @CurrentUser() user: User) {
    return this.expenses.pay(id, dto, user.id);
  }
}
