import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

export function ApiJwtAuth() {
  return applyDecorators(ApiBearerAuth('JWT-auth'));
}
