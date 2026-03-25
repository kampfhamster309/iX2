import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UpdateSystemConfigDto } from './dto/update-system-config.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';

const CONFIG_ID = 1;

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private async ensureSystemConfig() {
    return this.prisma.systemConfig.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
  }

  private async ensureCompanyProfile() {
    return this.prisma.companyProfile.upsert({
      where: { id: CONFIG_ID },
      update: {},
      create: { id: CONFIG_ID },
    });
  }

  async getAll() {
    const [system, company] = await Promise.all([
      this.ensureSystemConfig(),
      this.ensureCompanyProfile(),
    ]);
    return { system, company };
  }

  async updateSystemConfig(dto: UpdateSystemConfigDto) {
    await this.ensureSystemConfig();
    return this.prisma.systemConfig.update({
      where: { id: CONFIG_ID },
      data: dto,
    });
  }

  async updateCompanyProfile(dto: UpdateCompanyProfileDto) {
    await this.ensureCompanyProfile();
    return this.prisma.companyProfile.update({
      where: { id: CONFIG_ID },
      data: dto,
    });
  }

  async uploadLogo(buffer: Buffer, filename: string) {
    const existing = await this.ensureCompanyProfile();

    // Delete old logo if present
    if (existing.logoPath) {
      this.storage.delete(existing.logoPath);
    }

    const logoPath = await this.storage.save(buffer, filename, 'logos');
    return this.prisma.companyProfile.update({
      where: { id: CONFIG_ID },
      data: { logoPath },
    });
  }
}
