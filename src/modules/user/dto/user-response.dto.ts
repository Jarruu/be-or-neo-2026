import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../../../prisma/generated-client/client';

export class UserProfileResponseDto {
  @ApiProperty({ example: 'John Doe' })
  fullName: string;

  @ApiProperty({ example: '1234567890', required: false })
  nim?: string;
}

export class UserResponseDto {
  @ApiProperty({ example: 'u-123-uuid' })
  id: string;

  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2026-04-30T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-04-30T10:00:00Z' })
  updatedAt: Date;

  @ApiProperty({ type: UserProfileResponseDto, required: false })
  profile?: UserProfileResponseDto;
}
