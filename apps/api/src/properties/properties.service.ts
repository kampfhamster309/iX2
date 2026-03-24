import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  private isAdminOrManager(user: JwtPayload): boolean {
    return user.role === Role.ADMIN || user.role === Role.MANAGER;
  }

  private buildScopeWhere(user: JwtPayload) {
    if (user.role === Role.ADMIN) return {};
    // MANAGER, ACCOUNTANT, MAINTENANCE — scoped to assigned properties
    return {
      managers: {
        some: { userId: user.sub },
      },
    };
  }

  async findAll(user: JwtPayload, query: PropertyQueryDto) {
    const { page = 1, limit = 20, status, city } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...this.buildScopeWhere(user),
      ...(status ? { status } : {}),
      ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        include: { owner: true, managers: { include: { user: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.property.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, user: JwtPayload) {
    const where = { id, ...this.buildScopeWhere(user) };
    const property = await this.prisma.property.findFirst({
      where,
      include: { owner: true, managers: { include: { user: true } }, units: true },
    });
    if (!property) throw new NotFoundException('Property not found');
    return property;
  }

  async create(dto: CreatePropertyDto, user: JwtPayload) {
    if (!this.isAdminOrManager(user)) {
      throw new ForbiddenException('Only ADMIN or MANAGER can create properties');
    }

    const property = await this.prisma.property.create({
      data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        postalCode: dto.postalCode,
        country: dto.country ?? 'DE',
        ownerId: dto.ownerId,
        status: dto.status,
      },
      include: { owner: true },
    });

    // If creating user is a MANAGER, auto-assign them
    if (user.role === Role.MANAGER) {
      await this.prisma.propertyManager.create({
        data: { propertyId: property.id, userId: user.sub },
      });
    }

    return property;
  }

  async update(id: string, dto: UpdatePropertyDto, user: JwtPayload) {
    // Verify access (throws if not accessible)
    await this.findOne(id, user);

    if (!this.isAdminOrManager(user)) {
      throw new ForbiddenException('Only ADMIN or MANAGER can update properties');
    }

    return this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode } : {}),
        ...(dto.country !== undefined ? { country: dto.country } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      },
      include: { owner: true },
    });
  }

  async remove(id: string, user: JwtPayload) {
    if (user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can delete properties');
    }
    // Verify it exists
    await this.findOne(id, user);
    return this.prisma.property.delete({ where: { id } });
  }

  async assignManager(propertyId: string, userId: string, requestingUser: JwtPayload) {
    if (requestingUser.role !== Role.ADMIN) {
      throw new ForbiddenException('Only ADMIN can assign managers');
    }
    // Verify property exists
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found');

    return this.prisma.propertyManager.upsert({
      where: { propertyId_userId: { propertyId, userId } },
      create: { propertyId, userId },
      update: {},
    });
  }
}
