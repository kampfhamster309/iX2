import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDeductionDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Reason for the deduction' })
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Account ID to credit (e.g. expense account or income account)' })
  @IsString()
  accountId: string;

  @ApiPropertyOptional({ description: 'Optional reference to an existing expense' })
  @IsOptional()
  @IsString()
  expenseId?: string;
}
