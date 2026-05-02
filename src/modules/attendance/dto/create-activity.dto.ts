import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({ description: 'Name of the activity', example: 'Opening Ceremony' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Deadline for attendance',
    example: '2026-03-23T10:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  deadline: string;
}
