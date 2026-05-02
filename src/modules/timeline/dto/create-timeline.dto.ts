import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';

export class CreateTimelineDto {
  @ApiProperty({
    example: 'Pendaftaran',
    description: 'The title of the recruitment timeline event',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({
    example: 'Masa pendaftaran calon anggota baru',
    description: 'A brief description of the recruitment timeline event',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '2026-03-01T00:00:00Z',
    description: 'The start date and time of the event',
    format: 'date-time',
  })
  @IsDateString()
  @IsNotEmpty()
  startAt: string;

  @ApiProperty({
    example: '2026-03-14T23:59:59Z',
    description: 'The end date and time of the event',
    format: 'date-time',
  })
  @IsDateString()
  @IsNotEmpty()
  endAt: string;

  @ApiProperty({
    example: 0,
    description: 'The order index for sorting events',
  })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  orderIndex: number;
}
