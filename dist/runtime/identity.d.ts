import type { RuntimeConfig } from "../types.js";
export interface RuntimeIdentity {
    configId: string;
    deviceId: string;
    containerId?: string | null;
    integrationId?: string | null;
}
/**
 * Resolve the Core-owned config id from a runtime config-like payload.
 */
export declare function resolveConfigId(config: Partial<RuntimeConfig> & Record<string, unknown>): string;
/**
 * Resolve the integration-owned device id from a runtime config-like payload.
 */
export declare function resolveDeviceId(config: Partial<RuntimeConfig> & Record<string, unknown>): string;
/**
 * Build the canonical identity record used by runtime registries and examples.
 */
export declare function buildRuntimeIdentity(config: Partial<RuntimeConfig> & Record<string, unknown>, options?: {
    containerId?: string | null;
    integrationId?: string | null;
}): RuntimeIdentity;
