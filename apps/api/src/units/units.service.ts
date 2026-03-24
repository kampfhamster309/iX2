import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { UnitStatus, UnitType } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Injectable()
export class UnitsService {
  constructor(
    private prisma: PrismaService,
    private propertiesService: PropertiesService,
  ) {}

  async findAll(
    propertyId: string,
    user: JwtPayload,
    filters?: { status?: UnitStatus; type?: UnitType },
  ) {
    // Verify access to parent property
    await this.propertiesService.findOne(propertyId, user);

    const where = {
      propertyId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.type ? { type: filters.type } : {}),
    };

    return this.prisma.unit.findMany({
      where,
      include: { contracts: { where: { status: 'ACTIVE' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(propertyId: string, unitId: string, user: JwtPayload) {
    // Verify access to parent property
    await this.propertiesService.findOne(propertyId, user);

    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, propertyId },
      include: { contracts: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async create(propertyId: string, dto: CreateUnitDto, user: JwtPayload) {
    // Verify access to parent property
    await this.propertiesService.findOne(propertyId, user);

    return this.prisma.unit.create({
      data: {
        name: dto.name,
        type: dto.type,
        floor: dto.floor,
        areaSqm: dto.areaSqm,
        rooms: dto.rooms,
        propertyId,
      },
    });
  }

  async update(propertyId: string, unitId: string, dto: UpdateUnitDto, user: JwtPayload) {
    // Verify access
    await this.findOne(propertyId, unitId, user);

    return this.prisma.unit.update({
      where: { id: unitId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
        ...(dto.areaSqm !== undefined ? { areaSqm: dto.areaSqm } : {}),
        ...(dto.rooms !== undefined ? { rooms: dto.rooms } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
  }

  async remove(propertyId: string, unitId: string, user: JwtPayload) {
    // Verify access
    await this.findOne(propertyId, unitId, user);

    // Check for active contracts
    const activeContracts = await this.prisma.contract.count({
      where: { unitId, status: 'ACTIVE' },
    });
    if (activeContracts > 0) {
      throw new ConflictException('Cannot delete a unit with active contracts');
    }

    return this.prisma.unit.delete({ where: { id: unitId } });
  }
}
