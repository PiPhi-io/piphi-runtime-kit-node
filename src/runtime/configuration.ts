import type {
  RuntimeConfig,
  RuntimeConfigApplyResponse,
  RuntimeConfigRemoveResponse,
} from "../types.js";

export const DEFAULT_CONFIG_SECRET_KEYS = [
  "password", "token", "secret", "apiKey", "api_key",
  "accessToken", "access_token", "refreshToken", "refresh_token",
] as const;

export type RuntimeConfigValidator<T> = ((payload: unknown) => T) | { parse(payload: unknown): T };

/**
 * Redact likely secret fields before logging configs.
 */
export function redactConfigSecrets<T extends Record<string, unknown>>(
  config: T,
  options: { secretKeys?: readonly string[] } = {},
): T {
  const secretKeys = new Set(
    (options.secretKeys ?? DEFAULT_CONFIG_SECRET_KEYS).map((key) => key.toLowerCase()),
  );
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
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
  return redact(config) as T;
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

export function validateTypedConfig<T>(payload: unknown, validator: RuntimeConfigValidator<T>): T {
  return typeof validator === "function" ? validator(payload) : validator.parse(payload);
}

export function validateTypedConfigs<T>(
  payloads: readonly unknown[],
  validator: RuntimeConfigValidator<T>,
): T[] {
  return payloads.map((payload) => validateTypedConfig(payload, validator));
}
