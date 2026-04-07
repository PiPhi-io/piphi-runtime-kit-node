/**
 * Runtime auth header names used by PiPhi Core when it calls an integration.
 */
export declare const RUNTIME_CONTAINER_ID_HEADER_NAME = "x-container-id";
export declare const RUNTIME_INTERNAL_TOKEN_HEADER_NAME = "x-piphi-integration-token";
export interface RuntimeAuthHeaders {
    containerId?: string | null;
    internalToken?: string | null;
}
export interface RuntimeResolveOptions {
    containerId?: string | null;
    internalToken?: string | null;
}
/**
 * Mask a token for logs without exposing the full secret.
 */
export declare function maskToken(token?: string | null): string;
/**
 * Extract PiPhi runtime auth headers from a request-like header mapping.
 */
export declare function extractRuntimeAuthHeaders(headers: Headers | Record<string, string | undefined>): RuntimeAuthHeaders;
/**
 * Build outbound auth headers for calls back to PiPhi Core.
 */
export declare function buildRuntimeAuthHeaders(headers: RuntimeAuthHeaders): Record<string, string>;
/**
 * Small mutable auth context shared across one runtime process.
 */
export declare class RuntimeAuthContext {
    containerId: string | null;
    internalToken: string | null;
    /**
     * Update the in-memory auth context.
     */
    update(values: RuntimeAuthHeaders): void;
    /**
     * Sync auth context from request-like headers and optional payload scope.
     */
    syncFromHeaders(headers: Headers | Record<string, string | undefined>, payloadContainerId?: string | null): RuntimeAuthHeaders;
    /**
     * Resolve auth for an outbound Core call, preferring explicit values.
     */
    resolve(options?: RuntimeResolveOptions): Required<RuntimeAuthHeaders>;
}
/**
 * Format a runtime auth sync log line without leaking secrets.
 */
export declare function formatRuntimeAuthSyncLog(parsedHeaders: RuntimeAuthHeaders, payloadContainerId?: string | null): string;
