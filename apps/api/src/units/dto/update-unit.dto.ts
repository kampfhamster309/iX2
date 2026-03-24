import { PartialType } from '@nestjs/swagger';
import { CreateUnitDto } from './create-unit.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { UnitStatus } from '@prisma/client';

export class UpdateUnitDto extends PartialType(CreateUnitDto) {
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;
}
