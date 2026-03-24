import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, UnitStatus, UnitType } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { IsEnum, IsOptional } from 'class-validator';

class UnitQueryDto {
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;
}

@ApiTags('units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties/:propertyId/units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Get()
  findAll(
    @Param('propertyId') propertyId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: UnitQueryDto,
  ) {
    return this.unitsService.findAll(propertyId, user, query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateUnitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unitsService.create(propertyId, dto, user);
  }

  @Get(':id')
  findOne(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unitsService.findOne(propertyId, id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unitsService.update(propertyId, id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('propertyId') propertyId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.unitsService.remove(propertyId, id, user);
  }
}
