import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Role } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, role: Role.TENANT },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(rawRefreshToken: string) {
    const { tokenId, secret } = this.parseRefreshToken(rawRefreshToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenId },
    });

    if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const valid = await bcrypt.compare(secret, stored.tokenHash);
    if (!valid) throw new UnauthorizedException('Invalid or expired refresh token');

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.users.findById(stored.userId);
    if (!user) throw new UnauthorizedException();

    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(rawRefreshToken: string) {
    try {
      const { tokenId, secret } = this.parseRefreshToken(rawRefreshToken);

      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenId },
      });

      if (stored && stored.revokedAt === null) {
        const valid = await bcrypt.compare(secret, stored.tokenHash);
        if (valid) {
          await this.prisma.refreshToken.update({
            where: { id: stored.id },
            data: { revokedAt: new Date() },
          });
        }
      }
    } catch {
      // Silently ignore malformed tokens on logout
    }
    return { message: 'Logged out' };
  }

  private parseRefreshToken(rawRefreshToken: string): {
    tokenId: string;
    secret: string;
  } {
    const colonIndex = rawRefreshToken.indexOf(':');
    if (colonIndex === -1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const tokenId = rawRefreshToken.substring(0, colonIndex);
    const secret = rawRefreshToken.substring(colonIndex + 1);
    if (!tokenId || !secret) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    return { tokenId, secret };
  }

  private async issueTokens(userId: string, email: string, role: Role) {
    const payload: JwtPayload = { sub: userId, email, role };

    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const accessExpiry = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRY');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accessToken = (this.jwt.sign as any)(payload, {
      secret: accessSecret,
      expiresIn: accessExpiry,
    });

    const tokenId = randomUUID();
    const rawSecret = randomUUID();
    const tokenHash = await bcrypt.hash(rawSecret, BCRYPT_ROUNDS);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: { tokenId, tokenHash, userId, expiresAt },
    });

    return { accessToken, refreshToken: `${tokenId}:${rawSecret}` };
  }
}
