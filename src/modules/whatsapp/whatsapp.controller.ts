import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../../prisma/generated-client/client';
import { WhatsAppService } from './whatsapp.service';
import { SendBulkWhatsAppDto } from './dto/send-bulk-whatsapp.dto';
import { ScheduleWhatsAppDto } from './dto/schedule-whatsapp.dto';
import { WhatsAppBulkSendResponseDto } from './dto/whatsapp-response.dto';
import { ApiJwtAuth } from '../../common/swagger/decorators/api-jwt-auth.decorator';

@ApiTags('Waway Whatsapp')
@ApiJwtAuth()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('admin/send-bulk')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Send bulk WhatsApp messages',
    description:
      'Sends a WhatsApp message to all users who have a registered WhatsApp number in their profile. The message supports the {{name}} placeholder which will be replaced by the user nickName or fullName.',
  })
  @ApiBody({ type: SendBulkWhatsAppDto })
  @ApiResponse({
    status: 201,
    description: 'The bulk messages have been successfully queued for sending.',
    type: WhatsAppBulkSendResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have the ADMIN role.',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal Server Error - Failed to communicate with Waway API.',
  })
  async sendBulk(@Body() dto: SendBulkWhatsAppDto) {
    return this.whatsappService.sendBulkToAllUsers(dto.message);
  }

  @Post('admin/schedule')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Schedule a WhatsApp message',
    description:
      'Schedules a WhatsApp message to be sent to all active users at a specific date and time.',
  })
  @ApiBody({ type: ScheduleWhatsAppDto })
  @ApiResponse({
    status: 201,
    description: 'The message has been successfully scheduled.',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden.',
  })
  async schedule(@Body() dto: ScheduleWhatsAppDto) {
    return this.whatsappService.scheduleMessage(
      dto.message,
      new Date(dto.scheduledAt),
    );
  }
}
