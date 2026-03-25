import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';
import { JournalService } from './journal.service';
import { PostJournalEntryDto } from './dto/post-journal-entry.dto';
import { JournalQueryDto } from './dto/journal-query.dto';

@ApiTags('accounting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/journal-entries')
export class JournalController {
  constructor(private journal: JournalService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Post a new journal entry' })
  post(@Body() dto: PostJournalEntryDto, @CurrentUser() user: User) {
    return this.journal.post(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List journal entries (paginated, filterable)' })
  findAll(@Query() query: JournalQueryDto) {
    return this.journal.findAll(query);
  }
}
