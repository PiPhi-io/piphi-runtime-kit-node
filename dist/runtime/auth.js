/**
 * Runtime auth header names used by PiPhi Core when it calls an integration.
 */
export const RUNTIME_CONTAINER_ID_HEADER_NAME = "x-container-id";
export const RUNTIME_INTERNAL_TOKEN_HEADER_NAME = "x-piphi-integration-token";
/**
 * Mask a token for logs without exposing the full secret.
 */
export function maskToken(token) {
    if (!token) {
        return "<missing>";
    }
    if (token.length <= 6) {
        return `${token.slice(0, 1)}***`;
    }
    return `${token.slice(0, 3)}***${token.slice(-2)}`;
}
/**
 * Extract PiPhi runtime auth headers from a request-like header mapping.
 */
export function extractRuntimeAuthHeaders(headers) {
    const read = (name) => {
        if (headers instanceof Headers) {
            return headers.get(name) ?? undefined;
        }
        const direct = headers[name];
        if (direct !== undefined) {
            return direct;
        }
        return headers[name.toLowerCase()];
    };
    return {
        containerId: read(RUNTIME_CONTAINER_ID_HEADER_NAME) ?? null,
        internalToken: read(RUNTIME_INTERNAL_TOKEN_HEADER_NAME) ?? null,
    };
}
/**
 * Build outbound auth headers for calls back to PiPhi Core.
 */
export function buildRuntimeAuthHeaders(headers) {
    const result = {};
    if (headers.containerId) {
        result[RUNTIME_CONTAINER_ID_HEADER_NAME] = headers.containerId;
    }
    if (headers.internalToken) {
        result[RUNTIME_INTERNAL_TOKEN_HEADER_NAME] = headers.internalToken;
    }
    return result;
}
/**
 * Small mutable auth context shared across one runtime process.
 */
export class RuntimeAuthContext {
    containerId = null;
    internalToken = null;
    /**
     * Update the in-memory auth context.
     */
    update(values) {
        if (values.containerId !== undefined) {
            this.containerId = values.containerId ?? null;
        }
        if (values.internalToken !== undefined) {
            this.internalToken = values.internalToken ?? null;
        }
    }
    /**
     * Sync auth context from request-like headers and optional payload scope.
     */
    syncFromHeaders(headers, payloadContainerId) {
        const parsed = extractRuntimeAuthHeaders(headers);
        const nextValues = {};
        if (payloadContainerId !== undefined) {
            nextValues.containerId = payloadContainerId;
        }
        else if (parsed.containerId !== undefined) {
            nextValues.containerId = parsed.containerId;
        }
        if (parsed.internalToken !== undefined) {
            nextValues.internalToken = parsed.internalToken;
        }
        this.update(nextValues);
        return {
            containerId: this.containerId,
            internalToken: this.internalToken,
        };
    }
    /**
     * Resolve auth for an outbound Core call, preferring explicit values.
     */
    resolve(options = {}) {
        return {
            containerId: options.containerId ?? this.containerId,
            internalToken: options.internalToken ?? this.internalToken,
        };
    }
}
/**
 * Format a runtime auth sync log line without leaking secrets.
 */
export function formatRuntimeAuthSyncLog(parsedHeaders, payloadContainerId) {
    return [
        "runtime_auth_sync",
        `header_container_id=${parsedHeaders.containerId ?? "<missing>"}`,
        `payload_container_id=${payloadContainerId ?? "<missing>"}`,
        `internal_token=${maskToken(parsedHeaders.internalToken)}`,
    ].join(" ");
}
