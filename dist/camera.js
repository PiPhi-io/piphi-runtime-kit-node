export const CAMERA_MEDIA_CONTRACT_VERSION = "camera.media.v1";
export const CAMERA_MAX_SDP_BYTES = 256 * 1024;
export function cameraManifestCapability(declaration) {
    assertCameraCapability(declaration);
    const camera = {
        contract_version: CAMERA_MEDIA_CONTRACT_VERSION,
        refresh_seconds: declaration.refreshSeconds ?? 15,
    };
    const names = [
        ["source", "gateway_source_endpoint"], ["snapshot", "snapshot_endpoint"],
        ["events", "events_endpoint"], ["hls", "stream_endpoint"],
        ["webrtc", "webrtc_endpoint"], ["webrtcClose", "webrtc_close_endpoint"],
    ];
    for (const [field, manifestField] of names) {
        const value = declaration.endpoints[field];
        if (value)
            camera[manifestField] = value;
    }
    if (declaration.transports.includes("hls"))
        camera.stream_type = "hls";
    return { kind: "camera", value_kind: "camera", camera };
}
export function assertCameraCapability(declaration) {
    if (declaration.contractVersion !== CAMERA_MEDIA_CONTRACT_VERSION || declaration.messageType !== "camera.capability")
        throw new Error("Camera capability must use camera.media.v1.");
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,299}$/.test(declaration.capabilityId))
        throw new Error("Invalid camera capability id.");
    if (!declaration.transports.length || new Set(declaration.transports).size !== declaration.transports.length)
        throw new Error("Camera transports must be non-empty and unique.");
    const endpoints = Object.values(declaration.endpoints).filter((value) => typeof value === "string");
    if (!endpoints.length || endpoints.some((value) => !isSafeEndpoint(value)))
        throw new Error("Camera endpoints must be safe path-only values.");
}
export function assertCameraSource(source) {
    if (source.contract_version !== CAMERA_MEDIA_CONTRACT_VERSION || source.message_type !== "camera.source" || source.audience !== "core-sidecar")
        throw new Error("Invalid private camera source envelope.");
    if (source.source_url.length > 4096 || /[\r\n\0]/.test(source.source_url))
        throw new Error("Invalid camera source URL.");
    const parsed = new URL(source.source_url);
    if (parsed.protocol.slice(0, -1) !== source.source_protocol || !parsed.hostname)
        throw new Error("Camera source URL and protocol must match.");
}
function isSafeEndpoint(value) {
    return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.split("/").some((part) => part === "." || part === "..");
}
