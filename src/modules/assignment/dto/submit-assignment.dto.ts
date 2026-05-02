import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitAssignmentDto {
  @ApiPropertyOptional({
    example: 'Jawaban saya untuk assignment ini adalah ...',
    description: 'Text content for assignment submission',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  textContent?: string;
}
