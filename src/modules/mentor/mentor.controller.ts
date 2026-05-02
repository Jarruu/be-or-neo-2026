import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MentorService } from './mentor.service';
import { CreateMentorDto } from './dto/create-mentor.dto';
import { UpdateMentorDto } from './dto/update-mentor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../../prisma/generated-client/client';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';
import { ApiMultipartFormData } from '../../common/swagger/decorators/api-multipart-form-data.decorator';
import { ApiUuidParam } from '../../common/swagger/decorators/api-uuid-param.decorator';

@ApiTags('Admin: Mentor Management')
@Controller('mentors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiJwtAuth()
export class MentorController {
  constructor(private readonly mentorService: MentorService) {}

  @Post()
  @ApiOperation({
    summary: 'Admin: Create a new mentor',
    description:
      'Creates a mentor record with name, WhatsApp number, Instagram username, and an optional photo upload.',
  })
  @ApiMultipartFormData({ type: CreateMentorDto })
  @ApiResponse({ status: 201, description: 'Mentor successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid mentor payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @UseInterceptors(FileInterceptor('photo'))
  create(
    @Body() createMentorDto: CreateMentorDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.mentorService.create(createMentorDto, photo);
  }

  @Get()
  @ApiOperation({
    summary: 'Admin: Get all mentors',
    description: 'Returns the full mentor list ordered alphabetically by name.',
  })
  @ApiResponse({ status: 200, description: 'Return all mentors.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  findAll() {
    return this.mentorService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Admin: Get a specific mentor',
    description: 'Returns one mentor by ID.',
  })
  @ApiUuidParam('id', 'The mentor UUID')
  @ApiResponse({ status: 200, description: 'Mentor successfully retrieved.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'Mentor not found' })
  findOne(@Param('id') id: string) {
    return this.mentorService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Admin: Update a mentor',
    description:
      'Updates mentor data. The request may include a new photo file, which replaces the current photo URL.',
  })
  @ApiMultipartFormData({ type: UpdateMentorDto })
  @ApiUuidParam('id', 'The mentor UUID')
  @ApiResponse({ status: 200, description: 'Mentor successfully updated.' })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid mentor payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'Mentor not found' })
  @UseInterceptors(FileInterceptor('photo'))
  update(
    @Param('id') id: string,
    @Body() updateMentorDto: UpdateMentorDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return this.mentorService.update(id, updateMentorDto, photo);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Admin: Delete a mentor',
    description: 'Deletes a mentor record. User profiles linked to this mentor will follow database relation rules.',
  })
  @ApiUuidParam('id', 'The mentor UUID')
  @ApiResponse({ status: 204, description: 'Mentor successfully deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'Mentor not found' })
  remove(@Param('id') id: string) {
    return this.mentorService.remove(id);
  }
}
