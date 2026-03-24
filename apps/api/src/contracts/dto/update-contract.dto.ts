import { IsDateString, IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateContractDto {
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  rentAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
