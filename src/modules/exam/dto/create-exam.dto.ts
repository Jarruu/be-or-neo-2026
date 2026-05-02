import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExamType } from '../../../../prisma/generated-client/client';

export class ChoiceDto {
  @ApiProperty({
    example: 'Option A',
    description: 'The text label for the choice',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    example: true,
    description: 'Whether this choice is the correct answer',
  })
  @IsBoolean()
  isCorrect: boolean;

  @ApiProperty({
    example: 0,
    description: 'The display order of the choice',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  orderIndex: number;
}

export class CreateQuestionDto {
  @ApiProperty({
    enum: ExamType,
    description: 'The type of question (MCQ, TRUE_FALSE, or SHORT_TEXT)',
    example: ExamType.MCQ,
  })
  @IsEnum(ExamType)
  type: ExamType;

  @ApiProperty({
    example: 'What is the capital of Indonesia?',
    description: 'The question prompt or text',
  })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({
    example: 'Jakarta',
    description: 'The correct answer for short text questions',
    required: false,
  })
  @IsOptional()
  @IsString()
  correctTextAnswer?: string;

  @ApiProperty({
    example: 10,
    description: 'The number of points awarded for a correct answer',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  points: number;

  @ApiProperty({
    example: 1,
    description: 'The display order of the question in the exam',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  orderIndex: number;

  @ApiProperty({
    type: [ChoiceDto],
    description: 'The list of choices for multiple-choice questions',
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ChoiceDto)
  choices?: ChoiceDto[];
}

export class CreateExamDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the sub-division this exam is assigned to',
    format: 'uuid',
  })
  @IsUUID()
  subDivisionId: string;

  @ApiProperty({
    example: 'Web Development Basics',
    description: 'The title of the exam',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'This exam covers basic HTML, CSS, and JS',
    description: 'A detailed description of the exam',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: 60,
    description: 'The total duration of the exam in minutes',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  durationMinutes: number;

  @ApiProperty({
    example: 1,
    description: 'The maximum number of attempts allowed for this exam',
    default: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;

  @ApiProperty({
    example: '2026-03-01T08:00:00.000Z',
    description: 'The start date and time for exam availability',
    required: false,
  })
  @IsOptional()
  @IsString()
  startAt?: string;

  @ApiProperty({
    example: '2026-03-10T23:59:59.000Z',
    description: 'The end date and time for exam availability',
    required: false,
  })
  @IsOptional()
  @IsString()
  endAt?: string;

  @ApiProperty({
    example: true,
    description: 'Whether the exam is currently active and accessible',
    default: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    type: [CreateQuestionDto],
    description: 'The initial set of questions to be created with the exam',
    required: false,
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];
}
