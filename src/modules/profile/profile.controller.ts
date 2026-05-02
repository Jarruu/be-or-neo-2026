import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';
import { ApiMultipartFormData } from '../../common/swagger/decorators/api-multipart-form-data.decorator';
import { ApiUuidParam } from '../../common/swagger/decorators/api-uuid-param.decorator';

@ApiTags('Profile')
@ApiJwtAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the authenticated user profile together with related department, division, sub-division, study program, and mentor data.',
  })
  @ApiResponse({ status: 200, description: 'Return current user profile.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getMyProfile(@GetUser('id') userId: string) {
    return this.profileService.getProfile(userId);
  }

  @Get('departments')
  @ApiOperation({
    summary: 'Get all departments',
    description: 'Returns the department master list for profile selection forms.',
  })
  @ApiResponse({ status: 200, description: 'Return all departments.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDepartments() {
    return this.profileService.getDepartments();
  }

  @Get('divisions/:departmentId')
  @ApiOperation({
    summary: 'Get divisions by department ID',
    description: 'Returns divisions that belong to the specified department.',
  })
  @ApiUuidParam('departmentId', 'The department UUID')
  @ApiResponse({
    status: 200,
    description: 'Return divisions for the department.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getDivisions(@Param('departmentId') departmentId: string) {
    return this.profileService.getDivisions(departmentId);
  }

  @Get('sub-divisions/:divisionId')
  @ApiOperation({
    summary: 'Get sub-divisions by division ID',
    description: 'Returns sub-divisions that belong to the specified division.',
  })
  @ApiUuidParam('divisionId', 'The division UUID')
  @ApiResponse({
    status: 200,
    description: 'Return sub-divisions for the division.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getSubDivisions(@Param('divisionId') divisionId: string) {
    return this.profileService.getSubDivisions(divisionId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update current user profile',
    description:
      'Updates the authenticated user profile, including academic and organizational placement fields.',
  })
  @ApiResponse({ status: 200, description: 'Profile successfully updated.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async updateMyProfile(
    @GetUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({
    summary: 'Update profile avatar',
    description: 'Uploads and replaces the authenticated user avatar image.',
  })
  @ApiMultipartFormData({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Image file for the user avatar',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar successfully uploaded.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @GetUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.updateAvatar(userId, file);
  }
}
