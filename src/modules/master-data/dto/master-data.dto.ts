import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    example: 'Departemen Teknologi Informasi',
    description: 'The name of the department',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateDepartmentDto {
  @ApiProperty({
    example: 'Departemen Teknologi Informasi Terbaru',
    description: 'The updated name of the department',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class CreateDivisionDto {
  @ApiProperty({
    example: 'Divisi Web Development',
    description: 'The name of the division',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the department this division belongs to',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;
}

export class UpdateDivisionDto {
  @ApiProperty({
    example: 'Divisi Mobile Development',
    description: 'The updated name of the division',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The updated department ID for this division',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  departmentId?: string;
}

export class CreateSubDivisionDto {
  @ApiProperty({
    example: 'Sub-Divisi Frontend',
    description: 'The name of the sub-division',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The ID of the division this sub-division belongs to',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  divisionId: string;
}

export class UpdateSubDivisionDto {
  @ApiProperty({
    example: 'Sub-Divisi Backend',
    description: 'The updated name of the sub-division',
    required: false,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'The updated division ID for this sub-division',
    format: 'uuid',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  divisionId?: string;
}
