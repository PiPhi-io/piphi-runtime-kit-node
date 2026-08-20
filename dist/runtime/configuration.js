export const DEFAULT_CONFIG_SECRET_KEYS = [
    "password", "token", "secret", "apiKey", "api_key",
    "accessToken", "access_token", "refreshToken", "refresh_token",
];
/**
 * Redact likely secret fields before logging configs.
 */
export function redactConfigSecrets(config, options = {}) {
    const secretKeys = new Set((options.secretKeys ?? DEFAULT_CONFIG_SECRET_KEYS).map((key) => key.toLowerCase()));
    const redact = (value) => {
        if (Array.isArray(value))
            return value.map(redact);
        if (value !== null && typeof value === "object") {
            return Object.fromEntries(Object.entries(value).map(([key, child]) => [
                key,
                secretKeys.has(key.toLowerCase()) && child !== null && child !== ""
                    ? "***redacted***"
                    : redact(child),
            ]));
        }
        return value;
    };
    return redact(config);
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
export function validateTypedConfig(payload, validator) {
    return typeof validator === "function" ? validator(payload) : validator.parse(payload);
}
export function validateTypedConfigs(payloads, validator) {
    return payloads.map((payload) => validateTypedConfig(payload, validator));
}
