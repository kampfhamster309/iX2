import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRefundDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  refundDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}
