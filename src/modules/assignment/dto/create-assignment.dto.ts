import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAssignmentDto {
  @ApiProperty({
    example: 'Project 1: Personal Portfolio',
    description: 'The title of the assignment',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Build a one-page portfolio using HTML/CSS',
    description: 'A detailed description of the assignment tasks',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '2026-12-31T23:59:59.000Z',
    description: 'The deadline for the assignment submission in ISO format',
  })
  @IsDateString()
  @IsNotEmpty()
  dueAt: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the sub-division this assignment is for',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  subDivisionId: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The assignment task file (PDF, template, etc.)',
    required: false,
  })
  @IsOptional()
  file?: any;
}
