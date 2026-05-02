import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMentorDto {
  @ApiProperty({
    example: 'Budi Santoso',
    description: 'The name of the mentor',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    example: '081234567890',
    description: 'The WhatsApp number of the mentor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @ApiPropertyOptional({
    example: 'budisantoso99',
    description: 'The Instagram username of the mentor',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  instagramUsername?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'The photo image file of the mentor',
  })
  @IsOptional()
  photo?: any;
}
