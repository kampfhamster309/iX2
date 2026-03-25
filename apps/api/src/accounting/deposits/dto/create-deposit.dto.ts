import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepositDto {
  @ApiProperty()
  @IsString()
  contractId: string;

  @ApiProperty()
  @IsString()
  propertyId: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  receivedDate: string;
}
