import { formatRuntimeAuthSyncLog } from "../runtime/auth.js";
export function readFastifyHeaderValue(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
export function getPayloadContainerIdFromFastifyBody(body) {
    if (!body || typeof body !== "object") {
        return null;
    }
    const payload = body;
    if (typeof payload.containerId === "string") {
        return payload.containerId;
    }
    if (typeof payload.container_id === "string") {
        return payload.container_id;
    }
    return null;
}
export function syncRuntimeAuthFromFastifyRequest(runtime, req, payloadContainerId = getPayloadContainerIdFromFastifyBody(req.body)) {
    return runtime.auth.syncFromHeaders({
        "x-container-id": readFastifyHeaderValue(req.headers["x-container-id"]),
        "x-piphi-integration-token": readFastifyHeaderValue(req.headers["x-piphi-integration-token"]),
    }, payloadContainerId);
}
export function formatFastifyRuntimeAuthSyncLog(req, payloadContainerId = getPayloadContainerIdFromFastifyBody(req.body)) {
    return formatRuntimeAuthSyncLog({
        containerId: readFastifyHeaderValue(req.headers["x-container-id"]) ?? null,
        internalToken: readFastifyHeaderValue(req.headers["x-piphi-integration-token"]) ?? null,
    }, payloadContainerId);
}
/** Dispatch an automation command while honoring Core's idempotency header. */
export async function dispatchAutomationActionFromFastify(registry, req, payload = requireObjectBody(req.body)) {
    const idempotencyKey = readFastifyHeaderValue(req.headers["x-piphi-idempotency-key"]);
    return registry.dispatch(payload, {
        ...(idempotencyKey ? { idempotencyKey } : {}),
    });
}
function requireObjectBody(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new TypeError("Automation command body must be a JSON object");
    }
    return body;
}
