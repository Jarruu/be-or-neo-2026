import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Fakultas, UserRole } from '../../../../prisma/generated-client/client';

export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'The user email address',
    format: 'email',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.USER,
    description: 'The user role',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the user account is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 'Neo Telemetri',
    description: 'The full name of the user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Neo',
    description: 'The nickname of the user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nickName?: string;

  @ApiPropertyOptional({
    example: '2211521001',
    description: 'The student ID number (NIM)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nim?: string;

  @ApiPropertyOptional({
    example: '08123456789',
    description: 'The WhatsApp number of the user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @ApiPropertyOptional({
    enum: Fakultas,
    example: Fakultas.TEKNOLOGI_INFORMASI,
    description: 'The faculty of the user',
  })
  @IsOptional()
  @IsEnum(Fakultas)
  fakultas?: Fakultas;

  @ApiPropertyOptional({
    example: 'b2b7f6c2-7c12-4bc9-8c58-3bdf84f1b8fd',
    description: 'The study program selected by the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  studyProgramId?: string;

  @ApiPropertyOptional({
    example: '8b7f83f7-94e7-49ec-9d01-9ecdb68ac0d7',
    description: 'The department ID of the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    example: '9b1f4468-504f-442f-b8a7-04f5c7e75697',
    description: 'The division ID of the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  divisionId?: string;

  @ApiPropertyOptional({
    example: 'd93fef94-9362-4fa0-99c8-cd7372ed56f9',
    description: 'The sub-division ID of the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  subDivisionId?: string;

  @ApiPropertyOptional({
    example: 'a4b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    description: 'The mentor ID assigned to the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  mentorId?: string;
}
