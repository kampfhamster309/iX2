import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { PropertyStatus } from '@prisma/client';

export class CreatePropertyDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  postalCode: string;

  @ApiPropertyOptional({ default: 'DE' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty()
  @IsString()
  ownerId: string;

  @ApiPropertyOptional({ enum: PropertyStatus })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1800)
  yearBuilt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  numberOfFloors?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
