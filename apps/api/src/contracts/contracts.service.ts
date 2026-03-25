import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesService } from '../properties/properties.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatus, ContractType, Role } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export interface ContractQueryDto {
  page?: number;
  limit?: number;
  unitId?: string;
  tenantId?: string;
  status?: ContractStatus;
  propertyId?: string;
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private propertiesService: PropertiesService,
  ) {}

  async findAll(user: JwtPayload, query: ContractQueryDto) {
    const { page = 1, limit = 20, unitId, tenantId, status, propertyId } = query;
    const skip = (page - 1) * limit;

    // Build where clause with property scoping
    const where: Record<string, unknown> = {};

    if (unitId) where.unitId = unitId;
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;

    // Scope by property if requested or enforce role-based scoping
    if (propertyId) {
      // Verify user has access to that property
      await this.propertiesService.findOne(propertyId, user);
      where.unit = { propertyId };
    } else if (user.role !== Role.ADMIN) {
      // Non-admins can only see contracts for properties they manage
      where.unit = {
        property: {
          managers: { some: { userId: user.sub } },
        },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        include: {
          unit: { include: { property: true } },
          tenant: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contract.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, user: JwtPayload) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        unit: { include: { property: { include: { managers: true } } } },
        tenant: true,
      },
    });
    if (!contract) throw new NotFoundException('Contract not found');

    // Scope check
    if (user.role !== Role.ADMIN) {
      const isManager = contract.unit.property.managers.some((m) => m.userId === user.sub);
      if (!isManager) throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async create(dto: CreateContractDto, user: JwtPayload) {
    if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
      throw new ForbiddenException('Only ADMIN or MANAGER can create contracts');
    }

    // Verify unit exists and user has access to its property
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      include: { property: true },
    });
    if (!unit) throw new NotFoundException('Unit not found');

    // Verify access to the property
    await this.propertiesService.findOne(unit.propertyId, user);

    // Check no ACTIVE contract exists for this unit
    const existingActive = await this.prisma.contract.findFirst({
      where: { unitId: dto.unitId, status: ContractStatus.ACTIVE },
    });
    if (existingActive) {
      throw new ConflictException('Unit is already occupied');
    }

    // Create contract and update unit status in a transaction
    const [contract] = await this.prisma.$transaction([
      this.prisma.contract.create({
        data: {
          unitId: dto.unitId,
          tenantId: dto.tenantId,
          startDate: new Date(dto.startDate),
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          rentAmount: dto.rentAmount,
          depositAmount: dto.depositAmount ?? null,
          status: ContractStatus.ACTIVE,
          type: dto.type ?? ContractType.RESIDENTIAL_LEASE,
          notes: dto.notes,
        },
        include: { unit: true, tenant: true },
      }),
      this.prisma.unit.update({
        where: { id: dto.unitId },
        data: { status: 'OCCUPIED' },
      }),
    ]);

    return contract;
  }

  async update(id: string, dto: UpdateContractDto, user: JwtPayload) {
    if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
      throw new ForbiddenException('Only ADMIN or MANAGER can update contracts');
    }

    // Verify access
    await this.findOne(id, user);

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.rentAmount !== undefined ? { rentAmount: dto.rentAmount } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { unit: true, tenant: true },
    });
  }

  async terminate(id: string, user: JwtPayload) {
    if (user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
      throw new ForbiddenException('Only ADMIN or MANAGER can terminate contracts');
    }

    const contract = await this.findOne(id, user);

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new ConflictException('Contract is not active');
    }

    // Terminate the contract
    const updated = await this.prisma.contract.update({
      where: { id },
      data: { status: ContractStatus.TERMINATED },
      include: { unit: true, tenant: true },
    });

    // Check if any other ACTIVE contracts remain for this unit
    const remainingActive = await this.prisma.contract.count({
      where: { unitId: contract.unitId, status: ContractStatus.ACTIVE },
    });

    if (remainingActive === 0) {
      await this.prisma.unit.update({
        where: { id: contract.unitId },
        data: { status: 'VACANT' },
      });
    }

    return updated;
  }
}
