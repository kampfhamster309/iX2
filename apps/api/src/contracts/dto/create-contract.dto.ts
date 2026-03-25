import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsNumber, IsPositive, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ContractType } from '@prisma/client';

export class CreateContractDto {
  @IsString()
  unitId: string;

  @IsString()
  tenantId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  rentAmount: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  depositAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: ContractType })
  @IsEnum(ContractType)
  type: ContractType;
}
