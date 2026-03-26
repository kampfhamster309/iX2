import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  // ── Admin: list & create ──────────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all users (ADMIN only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.users.findAll(page ? Number(page) : 1, limit ? Number(limit) : 25);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user (ADMIN only)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  // ── Own profile — must be defined before :id routes ──────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get own profile' })
  getMe(@CurrentUser() user: User) {
    return this.users.findOne(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (cannot change role)' })
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Patch('me/password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  changeMyPassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.users.changeOwnPassword(user.id, dto);
  }

  // ── Admin: per-user management ────────────────────────────────────────────

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get any user by ID (ADMIN only)' })
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update profile fields for any user (ADMIN only)' })
  updateProfile(@Param('id') id: string, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(id, dto);
  }

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Change role for any user (ADMIN only)' })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.users.updateRole(id, dto.role);
  }

  @Patch(':id/password')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin password reset — no old password needed (ADMIN only)' })
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto) {
    return this.users.setPassword(id, dto.password);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a user account (ADMIN only)' })
  deactivate(@Param('id') id: string) {
    return this.users.setActive(id, false);
  }

  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reactivate a user account (ADMIN only)' })
  activate(@Param('id') id: string) {
    return this.users.setActive(id, true);
  }
}
