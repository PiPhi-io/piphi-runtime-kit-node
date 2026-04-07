/**
 * Diff two config id sets into apply and remove buckets.
 */
export function reconcileConfigIds(incomingConfigIds, activeConfigIds) {
    const incoming = new Set(incomingConfigIds);
    return {
        toKeep: activeConfigIds.filter((configId) => incoming.has(configId)),
        toRemove: activeConfigIds.filter((configId) => !incoming.has(configId)),
    };
}
/**
 * Build a standard config sync response.
 */
export function buildSyncResponse(values = {}) {
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
    processState;
    constructor(processState) {
        this.processState = processState;
    }
    async applySnapshot(snapshot, options) {
        const appliedConfigIds = [];
        const removedConfigIds = [];
        const skippedConfigIds = [];
        for (const config of snapshot.configs) {
            await options.applyConfig(config);
            appliedConfigIds.push(config.id);
        }
        const activeIds = options.getActiveConfigIds?.() ?? options.activeConfigIds;
        const { toRemove } = reconcileConfigIds(snapshot.configs.map((config) => config.id), activeIds);
        for (const configId of toRemove) {
            const removed = await options.removeConfig(configId);
            if (removed) {
                removedConfigIds.push(configId);
            }
            else {
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
