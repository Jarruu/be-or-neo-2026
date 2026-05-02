import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVerificationDto {
  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Scan of KRS (Kartu Rencana Studi) as proof of active student status',
  })
  @IsOptional()
  krsScan?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Formal photo of the applicant',
  })
  @IsOptional()
  formalPhoto?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Screenshot proof of following Neo Telemetri on Instagram',
  })
  @IsOptional()
  instagramProof?: any;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Screenshot proof of sharing marketing material on Instagram Story',
  })
  @IsOptional()
  instagramMarketingProof?: any;

  @ApiPropertyOptional({
    description: 'Link to the Instagram post using the official twibbon',
    example: 'https://www.instagram.com/p/C9x...',
  })
  @IsOptional()
  @IsString()
  @IsUrl()
  twibbonLink?: string;
}
