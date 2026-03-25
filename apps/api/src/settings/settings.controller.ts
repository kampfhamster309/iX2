import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import type { FastifyRequest } from 'fastify';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all application settings and company profile' })
  getAll() {
    return this.settings.getAll();
  }

  @Patch('system')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update system configuration (currency, language)' })
  updateSystem(@Body() dto: UpdateSystemConfigDto) {
    return this.settings.updateSystemConfig(dto);
  }

  @Patch('company')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update company profile text fields' })
  updateCompany(@Body() dto: UpdateCompanyProfileDto) {
    return this.settings.updateCompanyProfile(dto);
  }

  @Post('company/logo')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Upload company logo' })
  @ApiConsumes('multipart/form-data')
  async uploadLogo(@Req() req: FastifyRequest) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await (req as any).file();
    if (!data) throw new BadRequestException('No file provided');

    const mime: string = data.mimetype as string;
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(mime)) {
      throw new BadRequestException('Logo must be a PNG, JPEG, or WebP image');
    }

    const buffer = await data.toBuffer();
    return this.settings.uploadLogo(buffer, data.filename);
  }
}
