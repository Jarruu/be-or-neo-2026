import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateLearningModuleDto {
  @ApiProperty({
    example: 'Introduction to Web Development',
    description: 'The title of the learning module',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Basic HTML, CSS, and JS',
    description: 'A brief description of the module',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the sub-division this module belongs to',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  subDivisionId: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'The learning module file (e.g., PDF, DOCX)',
    required: false,
  })
  @IsOptional()
  file?: any;
}
