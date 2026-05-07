import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class ScheduleWhatsAppDto {
  @ApiProperty({
    description: 'The message content to be sent. Use {{name}} for user name.',
    example: 'Hello {{name}}, this is a scheduled message.',
  })
  @IsNotEmpty()
  @IsString()
  message: string;

  @ApiProperty({
    description: 'The date and time when the message should be sent.',
    example: '2026-05-07T10:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  scheduledAt: string;
}
