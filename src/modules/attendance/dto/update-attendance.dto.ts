import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AttendanceStatus } from '../../../../prisma/generated-client/client';

export class UpdateAttendanceDto {
  @ApiProperty({
    enum: AttendanceStatus,
    description: 'New attendance status',
    example: AttendanceStatus.PRESENT,
  })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiProperty({
    description: 'Notes for attendance',
    example: 'Sakit dengan surat dokter',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
