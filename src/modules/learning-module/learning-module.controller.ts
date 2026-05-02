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
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { LearningModuleService } from './learning-module.service';
import { CreateLearningModuleDto } from './dto/create-learning-module.dto';
import { UpdateLearningModuleDto } from './dto/update-learning-module.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../../prisma/generated-client/client';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';
import { ApiMultipartFormData } from '../../common/swagger/decorators/api-multipart-form-data.decorator';
import { ApiUuidParam } from '../../common/swagger/decorators/api-uuid-param.decorator';

@ApiTags('Learning Module')
@ApiJwtAuth()
@Controller('learning-modules')
export class LearningModuleController {
  constructor(private readonly learningModuleService: LearningModuleService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiMultipartFormData({ type: CreateLearningModuleDto })
  @ApiOperation({
    summary: 'Admin: Create a new learning module',
    description:
      'Creates a new learning module for a specific sub-division and uploads the attached file to Cloudinary. ' +
      'The API response includes a `fileUrl` that can be opened directly in the browser for preview.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Learning module successfully created. The returned `fileUrl` points to the Cloudinary asset.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  create(
    @Body() dto: CreateLearningModuleDto,
    @GetUser('id') adminId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.learningModuleService.create(dto, adminId, file);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get learning modules',
    description:
      'Admins receive all learning modules. Regular users receive only modules for their sub-division after submitting the exam. ' +
      'Each module includes a `fileUrl` that can be opened directly for preview on Cloudinary.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Modules successfully retrieved. Use the returned `fileUrl` for direct preview/open behavior.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@GetUser('id') userId: string, @GetUser('role') role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.learningModuleService.findAll();
    }
    return this.learningModuleService.findByUserId(userId);
  }

  @Get(':id/preview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Preview a learning module file',
    description:
      'Proxies the module file from Cloudinary for inline browser preview. ' +
      'The Content-Disposition is set to "inline" so the browser will attempt to render the file directly.',
  })
  @ApiUuidParam('id', 'The learning module ID')
  @ApiResponse({
    status: 200,
    description: 'File content streamed for inline preview.',
  })
  @ApiResponse({ status: 404, description: 'Module or file not found' })
  @ApiResponse({ status: 502, description: 'Could not retrieve file from storage' })
  async preview(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType } = await this.learningModuleService.download(
      id,
      userId,
      role,
    );

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Download a learning module file',
    description:
      'Proxies the module file from Cloudinary and forces a download with a descriptive filename.',
  })
  @ApiUuidParam('id', 'The learning module ID')
  @ApiResponse({
    status: 200,
    description: 'File content streamed as attachment download.',
  })
  @ApiResponse({ status: 404, description: 'Module or file not found' })
  @ApiResponse({ status: 502, description: 'Could not retrieve file from storage' })
  async download(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } =
      await this.learningModuleService.download(id, userId, role);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get a single learning module',
    description:
      'Retrieves a single learning module that the current user is allowed to access. ' +
      'The response includes `fileUrl` for direct preview/open to the Cloudinary asset.',
  })
  @ApiUuidParam('id', 'The learning module ID')
  @ApiResponse({
    status: 200,
    description:
      'Module successfully retrieved. Use `fileUrl` to open the file directly in Cloudinary.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
  ) {
    return this.learningModuleService.findOneForUser(id, userId, role);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiMultipartFormData({ type: UpdateLearningModuleDto })
  @ApiOperation({
    summary: 'Admin: Update a learning module',
    description:
      'Updates a learning module. If a new file is uploaded, the Cloudinary file URL is refreshed and returned in `fileUrl`.',
  })
  @ApiUuidParam('id', 'The learning module ID')
  @ApiResponse({
    status: 200,
    description:
      'Learning module successfully updated. The latest Cloudinary `fileUrl` is returned.',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Learning module not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLearningModuleDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.learningModuleService.update(id, dto, file);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Admin: Delete a learning module',
    description: 'Deletes the learning module record from the application.',
  })
  @ApiUuidParam('id', 'The learning module ID')
  @ApiResponse({
    status: 200,
    description: 'Learning module successfully deleted',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Learning module not found' })
  remove(@Param('id') id: string) {
    return this.learningModuleService.remove(id);
  }
}
