import { formatRuntimeAuthSyncLog, type RuntimeAuthHeaders } from "../runtime/auth.js";
import { type RuntimeContext } from "../runtime/context.js";

type ExpressHeaderValue = string | string[] | undefined;

export interface ExpressLikeRequest {
  headers: Record<string, ExpressHeaderValue>;
  body?: unknown;
  header(name: string): ExpressHeaderValue;
}

export function readExpressHeaderValue(value: ExpressHeaderValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export function getPayloadContainerIdFromExpressBody(body: unknown): string | null {
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

export function syncRuntimeAuthFromExpressRequest(
  runtime: RuntimeContext,
  req: ExpressLikeRequest,
  payloadContainerId = getPayloadContainerIdFromExpressBody(req.body),
): RuntimeAuthHeaders {
  return runtime.auth.syncFromHeaders(
    {
      "x-container-id": readExpressHeaderValue(req.header("x-container-id")),
      "x-piphi-integration-token": readExpressHeaderValue(
        req.header("x-piphi-integration-token"),
      ),
    },
    payloadContainerId,
  );
}

export function formatExpressRuntimeAuthSyncLog(
  req: ExpressLikeRequest,
  payloadContainerId = getPayloadContainerIdFromExpressBody(req.body),
): string {
  return formatRuntimeAuthSyncLog(
    {
      containerId: readExpressHeaderValue(req.header("x-container-id")) ?? null,
      internalToken:
        readExpressHeaderValue(req.header("x-piphi-integration-token")) ?? null,
    },
    payloadContainerId,
  );
}
