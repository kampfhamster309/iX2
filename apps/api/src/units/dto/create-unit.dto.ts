import { UnitType } from '@prisma/client';
import { IsString, IsEnum, IsOptional, IsNumber, IsPositive } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  name: string;

  @IsEnum(UnitType)
  type: UnitType;

  @IsOptional()
  @IsNumber()
  floor?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  areaSqm?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  rooms?: number;
}
