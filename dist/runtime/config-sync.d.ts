import type { RuntimeConfig, RuntimeConfigSnapshot, RuntimeConfigSyncResponse } from "../types.js";
import { RuntimeProcessState } from "./state.js";
type RuntimeEnv = Record<string, string | undefined>;
export declare const CORE_BASE_URL_ENV_NAME = "PIPHI_CORE_BASE_URL";
export declare const RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export declare const RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME = "PIPHI_CONFIG_SNAPSHOT_PATH";
export declare const DEFAULT_RUNTIME_VOLUME_DIR = "/.piphinetwork";
export declare const DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME = "configs.json";
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
