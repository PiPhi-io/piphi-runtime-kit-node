import type { RuntimeConfig, RuntimeConfigSnapshot, RuntimeConfigSyncResponse } from "../types.js";
import { RuntimeProcessState } from "./state.js";

/**
 * Diff two config id sets into apply and remove buckets.
 */
export function reconcileConfigIds(
  incomingConfigIds: string[],
  activeConfigIds: string[],
): { toKeep: string[]; toRemove: string[] } {
  const incoming = new Set(incomingConfigIds);
  return {
    toKeep: activeConfigIds.filter((configId) => incoming.has(configId)),
    toRemove: activeConfigIds.filter((configId) => !incoming.has(configId)),
  };
}

/**
 * Build a standard config sync response.
 */
export function buildSyncResponse(
  values: Partial<RuntimeConfigSyncResponse> = {},
): RuntimeConfigSyncResponse {
  return {
    ok: true,
    appliedConfigIds: values.appliedConfigIds ?? [],
    removedConfigIds: values.removedConfigIds ?? [],
    skippedConfigIds: values.skippedConfigIds ?? [],
    generation: values.generation ?? null,
  };
}

/**
 * Coordinate a snapshot apply/remove flow without owning vendor logic.
 */
export class ConfigSyncCoordinator {
  constructor(private readonly processState: RuntimeProcessState) {}

  async applySnapshot<TConfig extends RuntimeConfig>(
    snapshot: RuntimeConfigSnapshot<TConfig>,
    options: {
      activeConfigIds: string[];
      applyConfig: (config: TConfig) => Promise<unknown>;
      removeConfig: (configId: string) => Promise<boolean>;
      getActiveConfigIds?: () => string[];
    },
  ): Promise<RuntimeConfigSyncResponse> {
    const appliedConfigIds: string[] = [];
    const removedConfigIds: string[] = [];
    const skippedConfigIds: string[] = [];

    for (const config of snapshot.configs) {
      await options.applyConfig(config);
      appliedConfigIds.push(config.id);
    }

    const activeIds = options.getActiveConfigIds?.() ?? options.activeConfigIds;
    const { toRemove } = reconcileConfigIds(
      snapshot.configs.map((config) => config.id),
      activeIds,
    );

    for (const configId of toRemove) {
      const removed = await options.removeConfig(configId);
      if (removed) {
        removedConfigIds.push(configId);
      } else {
        skippedConfigIds.push(configId);
      }
    }

    this.processState.setCurrentGeneration(snapshot.generation ?? null);
    return buildSyncResponse({
      appliedConfigIds,
      removedConfigIds,
      skippedConfigIds,
      generation: snapshot.generation ?? null,
    });
  }
}
