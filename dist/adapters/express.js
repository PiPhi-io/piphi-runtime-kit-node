import { formatRuntimeAuthSyncLog } from "../runtime/auth.js";
export function readExpressHeaderValue(value) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
export function getPayloadContainerIdFromExpressBody(body) {
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
export function syncRuntimeAuthFromExpressRequest(runtime, req, payloadContainerId = getPayloadContainerIdFromExpressBody(req.body)) {
    return runtime.auth.syncFromHeaders({
        "x-container-id": readExpressHeaderValue(req.header("x-container-id")),
        "x-piphi-integration-token": readExpressHeaderValue(req.header("x-piphi-integration-token")),
    }, payloadContainerId);
}
export function formatExpressRuntimeAuthSyncLog(req, payloadContainerId = getPayloadContainerIdFromExpressBody(req.body)) {
    return formatRuntimeAuthSyncLog({
        containerId: readExpressHeaderValue(req.header("x-container-id")) ?? null,
        internalToken: readExpressHeaderValue(req.header("x-piphi-integration-token")) ?? null,
    }, payloadContainerId);
}
/** Dispatch an automation command while honoring Core's idempotency header. */
export async function dispatchAutomationActionFromExpress(registry, req, payload = requireObjectBody(req.body)) {
    const idempotencyKey = readExpressHeaderValue(req.header("x-piphi-idempotency-key"));
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
