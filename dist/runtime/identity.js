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
