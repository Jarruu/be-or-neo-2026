import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import { ExamService } from './exam.service';
import { SubmitExamDto } from './dto/user-exam.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@ApiTags('Exam')
@ApiBearerAuth('JWT-auth')
@Controller('exams/user')
@UseGuards(JwtAuthGuard)
export class ExamUserController {
  constructor(private readonly examService: ExamService) {}

  @Get('available')
  @ApiOperation({ summary: 'Get available exams for user subdivision' })
  @ApiResponse({ status: 200, description: 'Exams successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAvailable(@GetUser('id') userId: string) {
    return this.examService.findAvailableExams(userId);
  }

  @Get(':id') 
  findOne(@Param('id') id: string) {
    return this.examService.findOne(id);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start an exam attempt' })
  @ApiResponse({
    status: 201,
    description: 'Exam attempt successfully started',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  startAttempt(@Param('id') id: string, @GetUser('id') userId: string) {
    return this.examService.startAttempt(id, userId);
  }

  @Post('attempts/:attemptId/submit')
  @ApiOperation({ summary: 'Submit an exam attempt' })
  @ApiResponse({
    status: 201,
    description: 'Exam attempt successfully submitted',
  })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Exam attempt not found' })
  submitAttempt(
    @Param('attemptId') attemptId: string,
    @GetUser('id') userId: string,
    @Body() dto: SubmitExamDto,
  ) {
    return this.examService.submitAttempt(attemptId, userId, dto);
  }
}
