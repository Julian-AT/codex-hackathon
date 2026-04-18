export const STREAM_ERROR_LIMIT = 400;

export function truncateText(value: string, maxLength = STREAM_ERROR_LIMIT) {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

export function toErrorMessage(
  error: unknown,
  fallback = 'unknown error',
  maxLength = STREAM_ERROR_LIMIT,
) {
  if (error instanceof Error && error.message) {
    return truncateText(error.message, maxLength);
  }

  if (typeof error === 'string' && error) {
    return truncateText(error, maxLength);
  }

  return truncateText(String(error ?? fallback), maxLength);
}
