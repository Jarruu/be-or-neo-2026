import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '../../../../prisma/generated-client/client';

export class ReviewPaymentDto {
  @ApiProperty({
    enum: PaymentStatus,
    description: 'New status (APPROVED/REJECTED)',
    example: PaymentStatus.APPROVED,
  })
  @IsNotEmpty()
  @IsEnum([PaymentStatus.APPROVED, PaymentStatus.REJECTED])
  status: PaymentStatus;

  @ApiProperty({
    description: 'Reason for rejection (required if status is REJECTED)',
    example: 'Bukti pembayaran tidak terbaca',
    required: false,
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
