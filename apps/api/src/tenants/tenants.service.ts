import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export interface TenantQueryDto {
  page?: number;
  limit?: number;
  search?: string;
}

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(_user: JwtPayload, query: TenantQueryDto) {
    const { page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, _user: JwtPayload) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { contracts: { include: { unit: { include: { property: true } } } } },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async create(dto: CreateTenantDto, _user: JwtPayload) {
    if (dto.isCompany && !dto.companyName) {
      throw new BadRequestException('companyName is required for company tenants');
    }

    return this.prisma.tenant.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
        isCompany: dto.isCompany ?? false,
        companyName: dto.companyName,
        legalForm: dto.legalForm,
        taxId: dto.taxId,
        commercialRegisterNumber: dto.commercialRegisterNumber,
      },
    });
  }

  async update(id: string, dto: UpdateTenantDto, user: JwtPayload) {
    await this.findOne(id, user);
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.isCompany !== undefined ? { isCompany: dto.isCompany } : {}),
        ...(dto.companyName !== undefined ? { companyName: dto.companyName } : {}),
        ...(dto.legalForm !== undefined ? { legalForm: dto.legalForm } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.commercialRegisterNumber !== undefined
          ? { commercialRegisterNumber: dto.commercialRegisterNumber }
          : {}),
      },
    });
  }
}
