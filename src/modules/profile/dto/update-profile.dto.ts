import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Fakultas } from '../../../../prisma/generated-client/client';

export class UpdateProfileDto {
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
    example: '08123456789',
    description: 'The WhatsApp number of the user',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  whatsappNumber?: string;

  @ApiPropertyOptional({
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
    example: 'uuid-department',
    description: 'The department ID of the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({
    example: 'uuid-division',
    description: 'The division ID of the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  divisionId?: string;

  @ApiPropertyOptional({
    example: 'uuid-sub-division',
    description: 'The sub-division ID of the user',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  subDivisionId?: string;
}
