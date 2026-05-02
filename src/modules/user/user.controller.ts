import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Patch,
  Body,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiBody } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../../prisma/generated-client/client';
import { UpdateUserMentorDto } from './dto/update-user-mentor.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';
import { ApiUuidParam } from '../../common/swagger/decorators/api-uuid-param.decorator';

@ApiTags('Admin: User Management')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiJwtAuth()
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @ApiOperation({
    summary: 'Admin: Get all users',
    description:
      'Returns all users together with their profile relation for administrative management.',
  })
  @ApiResponse({
    status: 200,
    description: 'Return all users with their profiles',
    type: [UserResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Admin: Get a specific user by ID',
    description:
      'Returns one user together with related profile, payment, and verification data.',
  })
  @ApiUuidParam('id', 'The user UUID')
  @ApiResponse({
    status: 200,
    description: 'Return specific user details',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Admin: Update a user',
    description:
      'Updates user account data and profile fields for administrative management. Password changes are intentionally handled outside this endpoint.',
  })
  @ApiUuidParam('id', 'The user UUID')
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User successfully updated',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad Request - invalid user data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - email or NIM already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @GetUser('id') currentAdminId: string,
  ) {
    return this.userService.update(id, dto, currentAdminId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Admin: Delete a user',
    description:
      'Deletes a user account. Related data is handled according to the configured database cascade rules.',
  })
  @ApiUuidParam('id', 'The user UUID')
  @ApiResponse({
    status: 204,
    description: 'User successfully deleted (Cascading active)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - e.g., deleting yourself',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id') id: string, @GetUser('id') currentAdminId: string) {
    await this.userService.remove(id, currentAdminId);
  }

  @Patch(':id/mentor')
  @ApiOperation({
    summary: 'Admin: Assign mentor to a user',
    description:
      'Assigns a mentor to the specified user profile by mentor UUID.',
  })
  @ApiUuidParam('id', 'The user UUID')
  @ApiBody({ type: UpdateUserMentorDto })
  @ApiResponse({ status: 200, description: 'Mentor successfully assigned' })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - invalid mentor assignment payload',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'User or Profile not found' })
  async updateMentor(
    @Param('id') id: string,
    @Body() dto: UpdateUserMentorDto,
  ) {
    return this.userService.updateMentor(id, dto.mentorId);
  }

  @Patch(':id/toggle-active')
  @ApiOperation({
    summary: 'Admin: Toggle user active status',
    description:
      'Activates or deactivates a user account. Deactivated users can still log in, but their content view is frozen from the deactivation time.',
  })
  @ApiUuidParam('id', 'The user UUID')
  @ApiResponse({
    status: 200,
    description: 'User status successfully toggled',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admins only' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async toggleActive(
    @Param('id') id: string,
    @GetUser('id') currentAdminId: string,
  ) {
    return this.userService.toggleActive(id, currentAdminId);
  }
}
