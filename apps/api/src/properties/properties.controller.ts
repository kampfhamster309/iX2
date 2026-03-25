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
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyQueryDto } from './dto/property-query.dto';
import { CreatePropertyNoteDto } from './dto/create-property-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('properties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query() query: PropertyQueryDto) {
    return this.propertiesService.findAll(user, query);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  create(@Body() dto: CreatePropertyDto, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  update(@Param('id') id: string, @Body() dto: UpdatePropertyDto, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.remove(id, user);
  }

  @Post(':id/managers')
  @Roles(Role.ADMIN)
  assignManager(
    @Param('id') propertyId: string,
    @Body() body: { userId: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.propertiesService.assignManager(propertyId, body.userId, user);
  }

  @Post(':id/notes')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a note to a property' })
  addNote(
    @Param('id') id: string,
    @Body() dto: CreatePropertyNoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    // request.user is the full User from JwtStrategy.validate(); it has .id at runtime
    const userId: string = (user as unknown as { id: string }).id ?? user.sub;
    return this.propertiesService.addNote(id, dto.content, userId, user);
  }

  @Get(':id/notes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all notes for a property' })
  getNotes(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.propertiesService.getNotes(id, user);
  }
}
