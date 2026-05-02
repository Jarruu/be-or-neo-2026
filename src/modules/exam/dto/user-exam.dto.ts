import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartExamDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the exam to start',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  examId: string;
}

export class SubmitAnswerDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the question being answered',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  questionId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the chosen choice for multiple-choice questions',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  chosenChoiceId?: string;

  @ApiProperty({
    example: 'Jakarta',
    description: 'The text answer for short-answer questions',
    required: false,
  })
  @IsString()
  @IsOptional()
  textAnswer?: string;
}

export class SubmitExamDto {
  @ApiProperty({
    type: [SubmitAnswerDto],
    description: 'The list of answers being submitted for the exam attempt',
  })
  @IsNotEmpty()
  answers: SubmitAnswerDto[];
}
