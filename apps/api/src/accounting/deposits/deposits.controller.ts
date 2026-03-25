import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role, User } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { DepositsService } from './deposits.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { CreateDeductionDto } from './dto/create-deduction.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { DepositQueryDto } from './dto/deposit-query.dto';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/deposits')
export class DepositsController {
  constructor(private deposits: DepositsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Record a new security deposit' })
  recordDeposit(@Body() dto: CreateDepositDto, @CurrentUser() user: User) {
    return this.deposits.recordDeposit(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List security deposits (paginated, filterable)' })
  findAll(@Query() query: DepositQueryDto) {
    return this.deposits.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single security deposit' })
  findOne(@Param('id') id: string) {
    return this.deposits.findOne(id);
  }

  @Post(':id/deductions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Add a deduction to a security deposit' })
  addDeduction(
    @Param('id') id: string,
    @Body() dto: CreateDeductionDto,
    @CurrentUser() user: User,
  ) {
    return this.deposits.addDeduction(id, dto, user.id);
  }

  @Post(':id/refunds')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Add a refund to a security deposit' })
  addRefund(@Param('id') id: string, @Body() dto: CreateRefundDto, @CurrentUser() user: User) {
    return this.deposits.addRefund(id, dto, user.id);
  }
}
