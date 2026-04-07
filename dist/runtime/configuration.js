const DEFAULT_SECRET_KEYS = ["password", "token", "secret", "apiKey", "api_key"];
/**
 * Redact likely secret fields before logging configs.
 */
export function redactConfigSecrets(config) {
    const clone = { ...config };
    for (const key of Object.keys(clone)) {
        if (DEFAULT_SECRET_KEYS.includes(key)) {
            clone[key] = "***redacted***";
        }
    }
    return clone;
}
/**
 * Format a safe config-apply log line.
 */
export function formatConfigApplyLog(config) {
    return [
        "config_apply",
        `config_id=${config.id}`,
        `container_id=${config.containerId ?? "<missing>"}`,
        `integration_id=${config.integrationId ?? "<missing>"}`,
        `config=${JSON.stringify(redactConfigSecrets(config))}`,
    ].join(" ");
}
/**
 * Build a standard config-apply response payload.
 */
export function buildConfigApplyResponse(values) {
    return {
        ok: true,
        ...values,
    };
}
/**
 * Build a standard config-remove response payload.
 */
export function buildConfigRemoveResponse(values) {
    return {
        ok: true,
        ...values,
    };
}
