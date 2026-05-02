import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ExamService } from './exam.service';
import { CreateExamDto, CreateQuestionDto } from './dto/create-exam.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../../prisma/generated-client/client';

@ApiTags('Exam')
@ApiBearerAuth('JWT-auth')
@Controller('exams')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class ExamController {
  constructor(private readonly examService: ExamService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: Get all exams' })
  @ApiResponse({ status: 200, description: 'Exams successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  findAll() {
    return this.examService.findAll();
  }

  @Get('attempts/all')
  @ApiOperation({ summary: 'Admin: Get all exam attempts/results' })
  @ApiResponse({ status: 200, description: 'Attempts successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  getAllAttempts() {
    return this.examService.getAllAttempts();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: Get an exam by ID with questions' })
  @ApiResponse({ status: 200, description: 'Exam successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  findOne(@Param('id') id: string) {
    return this.examService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Admin: Create a new exam' })
  @ApiResponse({ status: 201, description: 'Exam successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  create(@Body() createExamDto: CreateExamDto) {
    return this.examService.create(createExamDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: Update exam details' })
  @ApiResponse({ status: 200, description: 'Exam successfully updated' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  update(@Param('id') id: string, @Body() updateExamDto: UpdateExamDto) {
    return this.examService.update(id, updateExamDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin: Delete an exam' })
  @ApiResponse({ status: 200, description: 'Exam successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  remove(@Param('id') id: string) {
    return this.examService.remove(id);
  }

  @Post(':id/questions')
  @ApiOperation({ summary: 'Admin: Add a question to an exam' })
  @ApiResponse({ status: 201, description: 'Question successfully added' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Exam not found' })
  addQuestion(@Param('id') id: string, @Body() dto: CreateQuestionDto) {
    return this.examService.addQuestion(id, dto);
  }

  @Delete('questions/:questionId')
  @ApiOperation({ summary: 'Admin: Delete a question' })
  @ApiResponse({ status: 200, description: 'Question successfully deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Question not found' })
  deleteQuestion(@Param('questionId') questionId: string) {
    return this.examService.deleteQuestion(questionId);
  }
}
