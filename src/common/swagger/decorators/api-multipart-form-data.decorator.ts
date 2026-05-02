import { applyDecorators, Type } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

type ApiMultipartFormDataOptions =
  | {
      type: Type<unknown>;
      schema?: never;
    }
  | {
      type?: never;
      schema: Record<string, unknown>;
    };

export function ApiMultipartFormData(options: ApiMultipartFormDataOptions) {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody(
      'type' in options ? { type: options.type } : { schema: options.schema },
    ),
  );
}
