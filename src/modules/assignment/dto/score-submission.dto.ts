import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ScoreSubmissionDto {
  @ApiProperty({
    example: 85.5,
    description: 'The score for the submission (0-100)',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  score: number;

  @ApiProperty({
    example: 'Great work, but focus on responsiveness.',
    description: 'Constructive feedback for the student',
    required: false,
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}
