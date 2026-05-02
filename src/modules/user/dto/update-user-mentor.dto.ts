import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserMentorDto {
  @ApiProperty({
    example: 'a4b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    description: 'The UUID of the mentor to be assigned to the user',
  })
  @IsNotEmpty()
  @IsUUID()
  mentorId: string;
}
