import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

const BCRYPT_ROUNDS = 12;

// Fields returned in all user responses — passwordHash is never included
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  username: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // ── Used internally by AuthService (needs passwordHash) ──────────────────

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  // ── Public API methods ────────────────────────────────────────────────────

  async findAll(page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        select: USER_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    if (dto.username) {
      const taken = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (taken) throw new ConflictException('Username already taken');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role ?? Role.TENANT,
        firstName: dto.firstName,
        lastName: dto.lastName,
        username: dto.username,
        phone: dto.phone,
      },
      select: USER_SELECT,
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    await this.findOne(id); // ensure exists

    if (dto.email) {
      const conflict = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (conflict && conflict.id !== id) throw new ConflictException('Email already in use');
    }

    if (dto.username) {
      const conflict = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (conflict && conflict.id !== id) throw new ConflictException('Username already taken');
    }

    return this.prisma.user.update({ where: { id }, data: dto, select: USER_SELECT });
  }

  async updateRole(id: string, role: Role) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { role }, select: USER_SELECT });
  }

  async setPassword(id: string, newPassword: string) {
    await this.findOne(id);
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    return this.prisma.user.update({ where: { id }, data: { passwordHash }, select: USER_SELECT });
  }

  async changeOwnPassword(id: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    return this.prisma.user.update({ where: { id }, data: { passwordHash }, select: USER_SELECT });
  }

  async setActive(id: string, isActive: boolean) {
    await this.findOne(id);
    return this.prisma.user.update({ where: { id }, data: { isActive }, select: USER_SELECT });
  }
}
