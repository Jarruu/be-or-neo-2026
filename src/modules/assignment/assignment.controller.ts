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
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ScoreSubmissionDto } from './dto/score-submission.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
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

@ApiTags('Assignment')
@ApiJwtAuth()
@Controller('assignments')
@UseGuards(JwtAuthGuard)
export class AssignmentController {
  constructor(private readonly assignmentService: AssignmentService) {}

  // --- Assignment Management ---

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiMultipartFormData({ type: CreateAssignmentDto })
  @ApiOperation({
    summary: 'Admin: Create new assignment',
    description:
      'Creates a new recruitment assignment for a specific sub-division. ' +
      'Admins can optionally upload a file (e.g., PDF instructions or templates) which will be stored on Cloudinary. ' +
      'The response includes a `fileUrl` that can be opened directly in the browser for preview.',
  })
  @ApiResponse({
    status: 201,
    description:
      'Assignment successfully created. The returned `fileUrl` points to the Cloudinary asset.',
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
    @Body() dto: CreateAssignmentDto,
    @GetUser('id') adminId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignmentService.create(dto, adminId, file);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all assignments (Admin) or user assignments (User)',
    description:
      'Admins receive all assignments in the system. ' +
      'Regular users receive only assignments for their chosen sub-division, provided they have submitted their exam. ' +
      'Each assignment includes a `fileUrl` that can be opened directly for preview on Cloudinary.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Assignments successfully retrieved. Use the returned `fileUrl` for direct preview/open behavior.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@GetUser('id') userId: string, @GetUser('role') role: UserRole) {
    if (role === UserRole.ADMIN) {
      return this.assignmentService.findAll();
    }
    return this.assignmentService.findByUserId(userId);
  }

  @Get('submissions/:submissionId/preview')
  @ApiOperation({
    summary: 'Preview User Submission (Admin/Owner)',
    description:
      'Proxies the user submitted file from Cloudinary for inline browser preview. ' +
      'Only accessible by Admins or the User who submitted the file. ' +
      'The browser will attempt to render the file directly (useful for PDF and Images).',
  })
  @ApiUuidParam('submissionId', 'The unique ID of the assignment submission')
  @ApiResponse({
    status: 200,
    description: 'File content streamed successfully for inline preview.',
    content: {
      'application/pdf': {},
      'image/jpeg': {},
      'image/png': {},
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid or missing token' })
  @ApiResponse({ status: 403, description: 'Forbidden - You do not have permission to access this submission' })
  @ApiResponse({ status: 404, description: 'Submission or file not found' })
  @ApiResponse({
    status: 502,
    description: 'Bad Gateway - Could not retrieve file from Cloudinary storage',
  })
  async previewSubmission(
    @Param('submissionId') submissionId: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType } =
      await this.assignmentService.downloadSubmission(submissionId, userId, role);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }

  @Get('submissions/:submissionId/download')
  @ApiOperation({
    summary: 'Download User Submission (Admin/Owner)',
    description:
      'Proxies the user submitted file from Cloudinary and forces a browser download with the original/formatted filename.',
  })
  @ApiUuidParam('submissionId', 'The unique ID of the assignment submission')
  @ApiResponse({
    status: 200,
    description: 'File content streamed successfully as an attachment.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Submission or file not found' })
  @ApiResponse({
    status: 502,
    description: 'Bad Gateway - Storage connection error',
  })
  async downloadSubmission(
    @Param('submissionId') submissionId: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } =
      await this.assignmentService.downloadSubmission(submissionId, userId, role);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/preview')
  @ApiOperation({
    summary: 'Preview an assignment file',
    description:
      'Proxies the assignment file from Cloudinary for inline browser preview. ' +
      'The Content-Disposition is set to "inline" so the browser will attempt to render the file directly.',
  })
  @ApiUuidParam('id', 'The assignment ID')
  @ApiResponse({
    status: 200,
    description: 'File content streamed for inline preview.',
  })
  @ApiResponse({ status: 404, description: 'Assignment or file not found' })
  @ApiResponse({ status: 502, description: 'Could not retrieve file from storage' })
  async preview(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType } = await this.assignmentService.download(
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
  @ApiOperation({
    summary: 'Download an assignment file',
    description:
      'Proxies the assignment file from Cloudinary and forces a download with a descriptive filename.',
  })
  @ApiUuidParam('id', 'The assignment ID')
  @ApiResponse({
    status: 200,
    description: 'File content streamed as attachment download.',
  })
  @ApiResponse({ status: 404, description: 'Assignment or file not found' })
  @ApiResponse({ status: 502, description: 'Could not retrieve file from storage' })
  async download(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, filename } =
      await this.assignmentService.download(id, userId, role);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    });

    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single assignment details',
    description:
      'Retrieves the full details of an assignment that the current user is allowed to access, including its file URL and sub-division information.',
  })
  @ApiUuidParam('id', 'The assignment ID')
  @ApiResponse({
    status: 200,
    description:
      'Assignment successfully retrieved. Use `fileUrl` to open the file directly in Cloudinary.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  findOne(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('role') role: UserRole,
  ) {
    return this.assignmentService.findOneForUser(id, userId, role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiMultipartFormData({ type: UpdateAssignmentDto })
  @ApiOperation({
    summary: 'Admin: Update assignment',
    description:
      'Updates an existing assignment. If a new file is uploaded, it will replace the previous one on Cloudinary and the latest `fileUrl` will be returned.',
  })
  @ApiUuidParam('id', 'The assignment ID')
  @ApiResponse({ status: 200, description: 'Assignment successfully updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.assignmentService.update(id, dto, file);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Delete assignment' })
  @ApiUuidParam('id', 'The assignment ID')
  @ApiResponse({ status: 200, description: 'Assignment successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  remove(@Param('id') id: string) {
    return this.assignmentService.remove(id);
  }

  // --- Submissions ---

  @Post(':id/submit')
  @ApiUuidParam('id', 'The assignment ID')
  @ApiMultipartFormData({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The assignment submission file',
        },
        textContent: {
          type: 'string',
          description: 'Text content for assignment submission',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Submit assignment' })
  @ApiResponse({
    status: 201,
    description: 'Assignment successfully submitted',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  submit(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @Body() dto: SubmitAssignmentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
        ],
        fileIsRequired: false,
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.assignmentService.submit(id, userId, file, dto.textContent);
  }

  @Get(':id/submissions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Get all submissions for an assignment' })
  @ApiUuidParam('id', 'The assignment ID')
  @ApiResponse({
    status: 200,
    description: 'Submissions successfully retrieved',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  getSubmissions(@Param('id') id: string) {
    return this.assignmentService.getSubmissions(id);
  }

  @Patch('submissions/:submissionId/score')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Score a submission' })
  @ApiUuidParam('submissionId', 'The assignment submission ID')
  @ApiResponse({ status: 200, description: 'Submission successfully scored' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  scoreSubmission(
    @Param('submissionId') submissionId: string,
    @Body() dto: ScoreSubmissionDto,
  ) {
    return this.assignmentService.scoreSubmission(submissionId, dto);
  }

}
