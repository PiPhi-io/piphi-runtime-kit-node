import type { RuntimeConfig, RuntimeConfigSnapshot, RuntimeConfigSyncResponse } from "../types.js";
import type { RuntimeContext } from "./context.js";
import { RuntimeProcessState } from "./state.js";
type RuntimeEnv = Record<string, string | undefined>;
export declare const CORE_BASE_URL_ENV_NAME = "PIPHI_CORE_BASE_URL";
export declare const RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export declare const RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME = "PIPHI_CONFIG_SNAPSHOT_PATH";
export declare const DEFAULT_RUNTIME_VOLUME_DIR = "/.piphinetwork";
export declare const DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME = "configs.json";
export declare const CORE_RUNTIME_CONFIG_FETCH_PATH = "/api/v2/integrations/config/fetch/all/by/container/internal";
export interface RuntimeConfigRehydrateResult {
    snapshotFound: boolean;
    snapshotApplied: boolean;
    snapshotConfigCount: number;
    snapshotGeneration: number | null;
    coreAttempted: boolean;
    coreApplied: boolean;
    coreConfigCount: number;
    coreGeneration: number | null;
    coreError: string | null;
    missingRuntimeAuth: boolean;
}
export interface RuntimeConfigRehydrateOptions<TConfig extends RuntimeConfig = RuntimeConfig> {
    runtimeContext: RuntimeContext;
    coreFetch?: typeof fetch;
    applySnapshot: (snapshot: RuntimeConfigSnapshot<TConfig>) => Promise<unknown>;
    mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
    coreBaseUrl?: string | null;
    timeoutMs?: number;
    snapshotPath?: string;
    snapshotVolumeDir?: string;
    snapshotReason?: string;
    coreReason?: string;
    raiseCoreErrors?: boolean;
}
export declare function resolveCoreBaseUrl(options?: {
    env?: RuntimeEnv;
    defaultValue?: string | null;
}): string | null;
export declare function resolveRuntimeConfigSnapshotPath(options?: {
    env?: RuntimeEnv;
    containerId?: string | null;
    volumeDir?: string;
}): string;
export declare function normalizeRuntimeConfigSnapshot<TConfig extends RuntimeConfig = RuntimeConfig>(payload: Record<string, unknown>): RuntimeConfigSnapshot<TConfig> | null;
export declare function loadRuntimeConfigSnapshot<TConfig extends RuntimeConfig = RuntimeConfig>(options?: {
    path?: string;
    env?: RuntimeEnv;
    containerId?: string | null;
    volumeDir?: string;
}): RuntimeConfigSnapshot<TConfig> | null;
export declare function buildRuntimeConfigSnapshotFromCoreRows<TConfig extends RuntimeConfig = RuntimeConfig>(rows: unknown[], options: {
    containerId: string;
    mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
    reason?: string;
}): RuntimeConfigSnapshot<TConfig>;
export declare function fetchCoreRuntimeConfigSnapshot<TConfig extends RuntimeConfig = RuntimeConfig>(options: {
    runtimeContext: RuntimeContext;
    coreFetch?: typeof fetch;
    coreBaseUrl?: string | null;
    timeoutMs?: number;
    mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
    reason?: string;
}): Promise<RuntimeConfigSnapshot<TConfig> | null>;
export declare function rehydrateRuntimeConfigs<TConfig extends RuntimeConfig = RuntimeConfig>(options: RuntimeConfigRehydrateOptions<TConfig>): Promise<RuntimeConfigRehydrateResult>;
/**
 * Diff two config id sets into apply and remove buckets.
 */
export declare function reconcileConfigIds(incomingConfigIds: string[], activeConfigIds: string[]): {
    toKeep: string[];
    toRemove: string[];
};
/**
 * Build a standard config sync response.
 */
export declare function buildSyncResponse(values?: Partial<RuntimeConfigSyncResponse>): RuntimeConfigSyncResponse;
/**
 * Coordinate a snapshot apply/remove flow without owning vendor logic.
 */
export declare class ConfigSyncCoordinator {
    private readonly processState;
    constructor(processState: RuntimeProcessState);
    applySnapshot<TConfig extends RuntimeConfig>(snapshot: RuntimeConfigSnapshot<TConfig>, options: {
        activeConfigIds: string[];
        applyConfig: (config: TConfig) => Promise<unknown>;
        removeConfig: (configId: string) => Promise<boolean>;
        getActiveConfigIds?: () => string[];
    }): Promise<RuntimeConfigSyncResponse>;
}
export {};
