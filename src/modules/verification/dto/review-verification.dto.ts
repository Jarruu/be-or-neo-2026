import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationStatus } from '../../../../prisma/generated-client/client';

export class ReviewVerificationDto {
  @ApiProperty({
    enum: VerificationStatus,
    description: 'The status of the verification submission',
    example: VerificationStatus.APPROVED,
  })
  @IsEnum(VerificationStatus)
  @IsNotEmpty()
  status: VerificationStatus;

  @ApiPropertyOptional({
    description: 'The reason for rejecting the submission',
    example: 'KRS scan is blurry and unreadable',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
