import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class ScanAttendanceDto {
  @ApiProperty({ description: 'User ID from scanned QR Code' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Activity ID' })
  @IsNotEmpty()
  @IsUUID()
  activityId: string;
}
