import type {
  RuntimeConfig,
  RuntimeConfigApplyResponse,
  RuntimeConfigRemoveResponse,
} from "../types.js";

const DEFAULT_SECRET_KEYS = ["password", "token", "secret", "apiKey", "api_key"];

/**
 * Redact likely secret fields before logging configs.
 */
export function redactConfigSecrets<T extends Record<string, unknown>>(config: T): T {
  const clone = { ...config };
  for (const key of Object.keys(clone)) {
    if (DEFAULT_SECRET_KEYS.includes(key)) {
      clone[key as keyof T] = "***redacted***" as T[keyof T];
    }
  }
  return clone;
}

/**
 * Format a safe config-apply log line.
 */
export function formatConfigApplyLog(config: RuntimeConfig & Record<string, unknown>): string {
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
export function buildConfigApplyResponse(
  values: Omit<RuntimeConfigApplyResponse, "ok">,
): RuntimeConfigApplyResponse {
  return {
    ok: true,
    ...values,
  };
}

/**
 * Build a standard config-remove response payload.
 */
export function buildConfigRemoveResponse(
  values: Omit<RuntimeConfigRemoveResponse, "ok">,
): RuntimeConfigRemoveResponse {
  return {
    ok: true,
    ...values,
  };
}
