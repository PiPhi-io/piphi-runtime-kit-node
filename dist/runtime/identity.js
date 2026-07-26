export class RuntimeIdentityError extends Error {
    constructor(message) {
        super(message);
        this.name = "RuntimeIdentityError";
    }
}
/** Stable Core/runtime identity for one configured device or account. */
export class RuntimeDeviceRef {
    configId;
    deviceId;
    containerId;
    integrationId;
    constructor(identity) {
        this.configId = identity.configId;
        this.deviceId = identity.deviceId;
        this.containerId = identity.containerId ?? null;
        this.integrationId = identity.integrationId ?? null;
    }
    static fromValue(config, options = {}) {
        const identity = buildRuntimeIdentity(config, options);
        const missing = [
            identity.configId === "missing" ? "configId" : null,
            identity.deviceId === "missing" ? "deviceId" : null,
        ].filter(Boolean);
        if (missing.length > 0) {
            throw new RuntimeIdentityError(`Runtime device identity is missing ${missing.join(", ")}. Use the configId supplied by PiPhi Core and a stable vendor deviceId.`);
        }
        return new RuntimeDeviceRef(identity);
    }
    requireEventScope() {
        const missing = [
            this.integrationId ? null : "integrationId",
            this.containerId ? null : "containerId",
        ].filter(Boolean);
        if (missing.length > 0) {
            throw new RuntimeIdentityError(`Runtime event delivery is missing ${missing.join(", ")}. Build the device reference from the Core-managed runtime registry entry.`);
        }
        return this;
    }
}
function normalizeString(value) {
    if (value === null || value === undefined) {
        return undefined;
    }
    const text = String(value).trim();
    return text ? text : undefined;
}
/**
 * Resolve the Core-owned config id from a runtime config-like payload.
 */
export function resolveConfigId(config) {
    return normalizeString(config.configId) ?? normalizeString(config.id) ?? "missing";
}
/**
 * Resolve the integration-owned device id from a runtime config-like payload.
 */
export function resolveDeviceId(config) {
    return normalizeString(config.deviceId) ?? normalizeString(config.id) ?? "missing";
}
/**
 * Build the canonical identity record used by runtime registries and examples.
 */
export function buildRuntimeIdentity(config, options = {}) {
    return {
        configId: resolveConfigId(config),
        deviceId: resolveDeviceId(config),
        containerId: options.containerId ?? (normalizeString(config.containerId) ?? null),
        integrationId: options.integrationId ?? (normalizeString(config.integrationId) ?? null),
    };
}
