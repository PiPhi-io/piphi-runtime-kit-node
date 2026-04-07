export declare class CoreDeliveryError extends Error {
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
    });
    toString(): string;
}
export declare class CoreUnavailableError extends CoreDeliveryError {
}
export declare class CoreTimeoutError extends CoreDeliveryError {
}
export declare class CoreRouteNotFoundError extends CoreDeliveryError {
}
export declare class CoreAuthError extends CoreDeliveryError {
}
export declare class CoreServerError extends CoreDeliveryError {
}
export declare class CoreUnexpectedResponseError extends CoreDeliveryError {
}
export declare function classifyCoreDeliveryError(options: {
    error: unknown;
    operation: string;
    url: string;
    timeoutMs?: number;
    response?: Response;
}): CoreDeliveryError;
