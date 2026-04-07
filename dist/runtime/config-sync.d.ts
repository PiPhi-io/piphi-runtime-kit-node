import type { RuntimeConfig, RuntimeConfigSnapshot, RuntimeConfigSyncResponse } from "../types.js";
import { RuntimeProcessState } from "./state.js";
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
