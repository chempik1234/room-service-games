/**
 * Custom error class for RoomService errors
 */

export class RoomServiceError extends Error {
  constructor(
    message: string,
    public code: number,
    public details?: string,
    public metadata?: { [key: string]: string }
  ) {
    super(message);
    this.name = 'RoomServiceError';
    Error.captureStackTrace?.(this, RoomServiceError);
  }

  /**
   * Check if this is an authentication error
   */
  isAuthenticationError(): boolean {
    return this.code === 16; // UNAUTHENTICATED
  }

  /**
   * Check if this is a permission error
   */
  isPermissionError(): boolean {
    return this.code === 7; // PERMISSION_DENIED
  }

  /**
   * Check if this is a "not found" error
   */
  isNotFoundError(): boolean {
    return this.code === 5; // NOT_FOUND
  }

  /**
   * Check if this is an invalid argument error
   */
  isInvalidArgumentError(): boolean {
    return this.code === 3; // INVALID_ARGUMENT
  }

  /**
   * Check if this is a network/server error (500 equivalent)
   */
  isServerError(): boolean {
    return this.code === 13 || // INTERNAL
           this.code === 14;    // UNAVAILABLE
  }

  /**
   * Check if this error is retryable (transient failures)
   */
  isRetryable(): boolean {
    return this.code === 14 || // UNAVAILABLE - service temporarily down
           this.code === 8 ||  // RESOURCE_EXHAUSTED - rate limited
           this.code === 4;    // DEADLINE_EXCEEDED - timeout
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case 16: // UNAUTHENTICATED
        return 'Authentication failed - check your API key';
      case 7: // PERMISSION_DENIED
        return 'Permission denied - your tenant may be suspended';
      case 5: // NOT_FOUND
        return 'Room not found - verify the room ID';
      case 13: // INTERNAL (500)
        return 'Server error - the service is temporarily unavailable';
      case 14: // UNAVAILABLE (503)
        return 'Service unavailable - please try again in a moment';
      case 3: // INVALID_ARGUMENT (400)
        return 'Invalid request format - check your command data';
      case 8: // RESOURCE_EXHAUSTED (429)
        return 'Rate limit exceeded - please try again later';
      default:
        return this.details || this.message;
    }
  }
}

/**
 * Type-safe interface for gRPC errors
 */
export interface GrpcError {
  code: number;
  details: string;
  message: string;
  metadata?: { [key: string]: string };
}

/**
 * Type guard to check if error is a gRPC error
 */
export function isGrpcError(error: unknown): error is GrpcError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

/**
 * Wrap a gRPC error into a RoomServiceError with proper type safety
 */
export function wrapGrpcError(error: unknown): RoomServiceError {
  if (error instanceof RoomServiceError) {
    return error;
  }

  if (isGrpcError(error)) {
    const grpcError = error as GrpcError;
    const code = grpcError.code || 2; // UNKNOWN
    const details = grpcError.details || grpcError.message || 'Unknown error';
    const metadata = grpcError.metadata || {};

    return new RoomServiceError(details, code, details, metadata);
  }

  // Handle generic errors
  if (error instanceof Error) {
    return new RoomServiceError(error.message, 2, error.message);
  }

  // Handle unknown error types
  return new RoomServiceError('Unknown error occurred', 2, String(error));
}
