import type { RuntimeConfig, RuntimeConfigApplyResponse, RuntimeConfigRemoveResponse } from "../types.js";
/**
 * Redact likely secret fields before logging configs.
 */
export declare function redactConfigSecrets<T extends Record<string, unknown>>(config: T): T;
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
