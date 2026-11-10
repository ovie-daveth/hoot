import { ApiErrorCode, ApiErrorShape } from './contracts/common';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly details?: unknown;

  constructor(args: { code: ApiErrorCode; message: string; status?: number; details?: unknown }) {
    super(args.message);
    this.name = 'ApiError';
    this.code = args.code;
    this.status = args.status;
    this.details = args.details;
  }

  static isApiError(value: unknown): value is ApiError {
    return value instanceof ApiError;
  }
}

export function toApiError(value: unknown, fallbackMessage = 'Something went wrong'): ApiError {
  if (ApiError.isApiError(value)) {
    return value;
  }
  const parsed = ApiErrorShape.safeParse(value);
  if (parsed.success) {
    return new ApiError({
      code: (ApiErrorCode.safeParse(parsed.data.code).success
        ? parsed.data.code
        : 'unknown') as ApiErrorCode,
      message: parsed.data.message,
    });
  }
  return new ApiError({ code: 'unknown', message: fallbackMessage });
}
