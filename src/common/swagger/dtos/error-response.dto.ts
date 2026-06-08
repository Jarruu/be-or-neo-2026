import { ApiProperty } from '@nestjs/swagger';

export class BadRequestErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description:
      'Error details. Can be a single message string or an array of validation error messages.',
    example: ['password must be longer than or equal to 6 characters'],
    type: 'string',
    isArray: true,
  })
  message: string | string[];

  @ApiProperty({
    description: 'HTTP error phrase',
    example: 'Bad Request',
  })
  error: string;
}

export class UnauthorizedErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error details',
    example: 'Unauthorized',
  })
  message: string;
}

export class ForbiddenErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 403,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error details',
    example: 'Forbidden resource',
  })
  message: string;

  @ApiProperty({
    description: 'HTTP error phrase',
    example: 'Forbidden',
  })
  error: string;
}

export class NotFoundErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 404,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error details',
    example: 'User with ID 550e8400-e29b-41d4-a716-446655440000 not found',
  })
  message: string;

  @ApiProperty({
    description: 'HTTP error phrase',
    example: 'Not Found',
  })
  error: string;
}
