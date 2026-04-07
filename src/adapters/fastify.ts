import { formatRuntimeAuthSyncLog, type RuntimeAuthHeaders } from "../runtime/auth.js";
import { type RuntimeContext } from "../runtime/context.js";

type FastifyHeaderValue = string | string[] | undefined;

export interface FastifyLikeRequest {
  headers: Record<string, FastifyHeaderValue>;
  body?: unknown;
}

export function readFastifyHeaderValue(value: FastifyHeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getPayloadContainerIdFromFastifyBody(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const payload = body as Record<string, unknown>;
  if (typeof payload.containerId === "string") {
    return payload.containerId;
  }
  if (typeof payload.container_id === "string") {
    return payload.container_id;
  }
  return null;
}

export function syncRuntimeAuthFromFastifyRequest(
  runtime: RuntimeContext,
  req: FastifyLikeRequest,
  payloadContainerId = getPayloadContainerIdFromFastifyBody(req.body),
): RuntimeAuthHeaders {
  return runtime.auth.syncFromHeaders(
    {
      "x-container-id": readFastifyHeaderValue(req.headers["x-container-id"]),
      "x-piphi-integration-token": readFastifyHeaderValue(
        req.headers["x-piphi-integration-token"],
      ),
    },
    payloadContainerId,
  );
}

export function formatFastifyRuntimeAuthSyncLog(
  req: FastifyLikeRequest,
  payloadContainerId = getPayloadContainerIdFromFastifyBody(req.body),
): string {
  return formatRuntimeAuthSyncLog(
    {
      containerId: readFastifyHeaderValue(req.headers["x-container-id"]) ?? null,
      internalToken:
        readFastifyHeaderValue(req.headers["x-piphi-integration-token"]) ?? null,
    },
    payloadContainerId,
  );
}
