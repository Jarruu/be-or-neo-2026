import { ApiParam } from '@nestjs/swagger';

export function ApiUuidParam(name: string, description: string) {
  return ApiParam({
    name,
    description,
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  });
}
