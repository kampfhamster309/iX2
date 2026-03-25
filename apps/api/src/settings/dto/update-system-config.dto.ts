import { IsEnum, IsOptional } from 'class-validator';
import { Currency, AppLanguage } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSystemConfigDto {
  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ enum: AppLanguage })
  @IsOptional()
  @IsEnum(AppLanguage)
  defaultLanguage?: AppLanguage;
}
