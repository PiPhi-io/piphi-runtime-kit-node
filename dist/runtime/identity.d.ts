import type { RuntimeConfig } from "../types.js";
export interface RuntimeIdentity {
    configId: string;
    deviceId: string;
    containerId?: string | null;
    integrationId?: string | null;
}
export declare class RuntimeIdentityError extends Error {
    constructor(message: string);
}
/** Stable Core/runtime identity for one configured device or account. */
export declare class RuntimeDeviceRef implements RuntimeIdentity {
    readonly configId: string;
    readonly deviceId: string;
    readonly containerId: string | null;
    readonly integrationId: string | null;
    constructor(identity: RuntimeIdentity);
    static fromValue(config: Partial<RuntimeConfig> & Record<string, unknown>, options?: {
        containerId?: string | null;
        integrationId?: string | null;
    }): RuntimeDeviceRef;
    requireEventScope(): RuntimeDeviceRef;
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
