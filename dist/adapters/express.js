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
