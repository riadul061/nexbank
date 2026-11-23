export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) { super(message); }
}
export const badRequest = (m: string, code?: string) => new ApiError(400, m, code);
export const unauthorized = (m = 'Authentication required') => new ApiError(401, m, 'UNAUTHENTICATED');
export const forbidden = (m = 'You do not have permission to perform this action') => new ApiError(403, m, 'FORBIDDEN');
export const notFound = (m = 'Resource not found') => new ApiError(404, m, 'NOT_FOUND');
export const conflict = (m: string, code?: string) => new ApiError(409, m, code);

/** Drizzle wraps driver errors; unwrap to the underlying pg error for code/constraint checks. */
export const pgError = (e: unknown): { code?: string; constraint?: string } => {
  const x = e as { code?: string; constraint?: string; cause?: unknown };
  return x?.cause && typeof x.cause === 'object' ? (x.cause as { code?: string; constraint?: string }) : x ?? {};
};
