import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class PayExpenseDto {
  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}
