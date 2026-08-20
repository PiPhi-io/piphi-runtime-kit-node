import type { RuntimeConfig, RuntimeConfigApplyResponse, RuntimeConfigRemoveResponse } from "../types.js";
export declare const DEFAULT_CONFIG_SECRET_KEYS: readonly ["password", "token", "secret", "apiKey", "api_key", "accessToken", "access_token", "refreshToken", "refresh_token"];
export type RuntimeConfigValidator<T> = ((payload: unknown) => T) | {
    parse(payload: unknown): T;
};
/**
 * Redact likely secret fields before logging configs.
 */
export declare function redactConfigSecrets<T extends Record<string, unknown>>(config: T, options?: {
    secretKeys?: readonly string[];
}): T;
/**
 * Format a safe config-apply log line.
 */
export declare function formatConfigApplyLog(config: RuntimeConfig & Record<string, unknown>): string;
/**
 * Build a standard config-apply response payload.
 */
export declare function buildConfigApplyResponse(values: Omit<RuntimeConfigApplyResponse, "ok">): RuntimeConfigApplyResponse;
/**
 * Build a standard config-remove response payload.
 */
export declare function buildConfigRemoveResponse(values: Omit<RuntimeConfigRemoveResponse, "ok">): RuntimeConfigRemoveResponse;
export declare function validateTypedConfig<T>(payload: unknown, validator: RuntimeConfigValidator<T>): T;
export declare function validateTypedConfigs<T>(payloads: readonly unknown[], validator: RuntimeConfigValidator<T>): T[];
