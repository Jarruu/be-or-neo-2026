import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UserRole } from '../../../prisma/generated-client/client';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@ApiResponse({ status: 401, description: 'Unauthorized' })
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('me')
  @ApiOperation({ summary: 'User: Get personalized dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Return dashboard stats and recruitment status.',
  })
  async getMyDashboard(@GetUser('id') userId: string) {
    return this.dashboardService.getMyDashboard(userId);
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: Get recruitment statistics and monitoring' })
  @ApiResponse({
    status: 200,
    description: 'Return global recruitment statistics.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  async getAdminStats() {
    return this.dashboardService.getAdminStats();
  }
}
