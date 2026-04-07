export class CoreDeliveryError extends Error {
  readonly operation: string;
  readonly url: string;
  readonly retryable: boolean;
  readonly statusCode?: number;
  readonly timeoutMs?: number;

  constructor(options: {
    operation: string;
    url: string;
    message: string;
    retryable: boolean;
    statusCode?: number;
    timeoutMs?: number;
  }) {
    super(options.message);
    this.name = new.target.name;
    this.operation = options.operation;
    this.url = options.url;
    this.retryable = options.retryable;
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options.timeoutMs !== undefined) {
      this.timeoutMs = options.timeoutMs;
    }
  }

  override toString(): string {
    return [
      this.message,
      `operation=${this.operation}`,
      `url=${this.url}`,
      this.statusCode !== undefined ? `statusCode=${this.statusCode}` : null,
      this.timeoutMs !== undefined ? `timeoutMs=${this.timeoutMs}` : null,
      `retryable=${this.retryable}`,
    ]
      .filter(Boolean)
      .join(" ");
  }
}

export class CoreUnavailableError extends CoreDeliveryError {}
export class CoreTimeoutError extends CoreDeliveryError {}
export class CoreRouteNotFoundError extends CoreDeliveryError {}
export class CoreAuthError extends CoreDeliveryError {}
export class CoreServerError extends CoreDeliveryError {}
export class CoreUnexpectedResponseError extends CoreDeliveryError {}

export function classifyCoreDeliveryError(options: {
  error: unknown;
  operation: string;
  url: string;
  timeoutMs?: number;
  response?: Response;
}): CoreDeliveryError {
  const { error, operation, url, timeoutMs, response } = options;

  if (response) {
    const statusCode = response.status;
    if (statusCode === 404) {
      const errorOptions = {
        operation,
        url,
        message: "PiPhi Core route is not available",
        retryable: false,
        statusCode,
      } as const;
      return new CoreRouteNotFoundError(
        timeoutMs !== undefined ? { ...errorOptions, timeoutMs } : errorOptions,
      );
    }
    if (statusCode === 401 || statusCode === 403) {
      const errorOptions = {
        operation,
        url,
        message: "PiPhi Core rejected the runtime authentication headers",
        retryable: false,
        statusCode,
      } as const;
      return new CoreAuthError(
        timeoutMs !== undefined ? { ...errorOptions, timeoutMs } : errorOptions,
      );
    }
    if (statusCode >= 500) {
      const errorOptions = {
        operation,
        url,
        message: "PiPhi Core failed while processing the delivery request",
        retryable: true,
        statusCode,
      } as const;
      return new CoreServerError(
        timeoutMs !== undefined ? { ...errorOptions, timeoutMs } : errorOptions,
      );
    }
    const errorOptions = {
      operation,
      url,
      message: "PiPhi Core returned an unexpected non-success response",
      retryable: false,
      statusCode,
    } as const;
    return new CoreUnexpectedResponseError(
      timeoutMs !== undefined ? { ...errorOptions, timeoutMs } : errorOptions,
    );
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    const errorOptions = {
      operation,
      url,
      message: "PiPhi Core did not respond before the request timeout",
      retryable: true,
    } as const;
    return new CoreTimeoutError(
      timeoutMs !== undefined ? { ...errorOptions, timeoutMs } : errorOptions,
    );
  }

  const errorOptions = {
    operation,
    url,
    message: "PiPhi Core is unreachable",
    retryable: true,
  } as const;
  return new CoreUnavailableError(
    timeoutMs !== undefined ? { ...errorOptions, timeoutMs } : errorOptions,
  );
}
