import { IsString, IsDateString, IsNumber, IsPositive, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

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
}
