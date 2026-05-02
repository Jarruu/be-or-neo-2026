import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { VerificationService } from './verification.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import {
  UserRole,
  VerificationStatus,
} from '../../../prisma/generated-client/client';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';
import { ApiMultipartFormData } from '../../common/swagger/decorators/api-multipart-form-data.decorator';
import { ApiUuidParam } from '../../common/swagger/decorators/api-uuid-param.decorator';

@ApiTags('Verification')
@ApiJwtAuth()
@UseGuards(JwtAuthGuard)
@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('admin/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Get all verification submissions' })
  @ApiResponse({ status: 200, description: 'Return list of submissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async findAll(@Query('status') status?: VerificationStatus) {
    return this.verificationService.findAll(status);
  }

  @Patch('admin/review/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Approve or Reject a submission' })
  @ApiUuidParam('id', 'The verification submission UUID')
  @ApiResponse({
    status: 200,
    description: 'Submission successfully reviewed',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Not Found - Submission not found' })
  async reviewSubmission(
    @Param('id') id: string,
    @GetUser('id') adminId: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.reviewSubmission(id, adminId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user verification status' })
  @ApiResponse({
    status: 200,
    description: 'Return current user verification data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyVerification(@GetUser('id') userId: string) {
    return this.verificationService.getMyVerification(userId);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit or update verification documents' })
  @ApiMultipartFormData({ type: CreateVerificationDto })
  @ApiResponse({
    status: 201,
    description: 'Verification documents successfully submitted',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'krsScan', maxCount: 1 },
      { name: 'formalPhoto', maxCount: 1 },
      { name: 'instagramProof', maxCount: 1 },
      { name: 'instagramMarketingProof', maxCount: 1 },
    ]),
  )
  async submitVerification(
    @GetUser('id') userId: string,
    @Body() dto: CreateVerificationDto,
    @UploadedFiles()
    files: {
      krsScan?: Express.Multer.File[];
      formalPhoto?: Express.Multer.File[];
      instagramProof?: Express.Multer.File[];
      instagramMarketingProof?: Express.Multer.File[];
    },
  ) {
    return this.verificationService.submitVerification(userId, dto, files);
  }
}
