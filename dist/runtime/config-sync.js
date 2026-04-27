import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
export const CORE_BASE_URL_ENV_NAME = "PIPHI_CORE_BASE_URL";
export const RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export const RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME = "PIPHI_CONFIG_SNAPSHOT_PATH";
export const DEFAULT_RUNTIME_VOLUME_DIR = "/.piphinetwork";
export const DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME = "configs.json";
function getString(payload, ...keys) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return null;
}
function getNumber(payload, ...keys) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string" && value.trim()) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }
    return null;
}
function getStringArray(payload, ...keys) {
    for (const key of keys) {
        const value = payload[key];
        if (Array.isArray(value)) {
            return value
                .filter((item) => typeof item === "string" && item.trim().length > 0)
                .map((item) => item.trim());
        }
    }
    return [];
}
export function resolveCoreBaseUrl(options = {}) {
    const env = options.env ?? process.env;
    const value = (env[CORE_BASE_URL_ENV_NAME] ?? "").trim().replace(/\/+$/, "");
    if (value) {
        return value;
    }
    const fallback = options.defaultValue?.trim().replace(/\/+$/, "");
    return fallback || null;
}
export function resolveRuntimeConfigSnapshotPath(options = {}) {
    const env = options.env ?? process.env;
    const explicitPath = (env[RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME] ?? "").trim();
    if (explicitPath) {
        return explicitPath;
    }
    const containerId = (options.containerId?.trim()
        || env[RUNTIME_CONTAINER_ID_ENV_NAME]?.trim());
    const volumeDir = options.volumeDir ?? DEFAULT_RUNTIME_VOLUME_DIR;
    if (containerId) {
        return join(volumeDir, `${containerId}.json`);
    }
    return join(volumeDir, DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME);
}
export function normalizeRuntimeConfigSnapshot(payload) {
    const configs = payload.configs;
    if (!Array.isArray(configs)) {
        return null;
    }
    return {
        schemaVersion: getNumber(payload, "schema_version", "schemaVersion"),
        containerId: getString(payload, "container_id", "containerId"),
        integrationId: getString(payload, "integration_id", "integrationId"),
        driverPid: getNumber(payload, "driver_pid", "driverPid"),
        reason: getString(payload, "reason"),
        generation: getNumber(payload, "generation"),
        updatedAt: getString(payload, "updated_at", "updatedAt"),
        configs: configs,
        deletedConfigIds: getStringArray(payload, "deleted_config_ids", "deletedConfigIds"),
        configHash: getString(payload, "config_hash", "configHash"),
        internalToken: getString(payload, "internal_token", "internalToken"),
    };
}
export function loadRuntimeConfigSnapshot(options = {}) {
    const snapshotPath = options.path ?? resolveRuntimeConfigSnapshotPath(options);
    if (!existsSync(snapshotPath)) {
        return null;
    }
    try {
        const payload = JSON.parse(readFileSync(snapshotPath, "utf-8"));
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            return null;
        }
        return normalizeRuntimeConfigSnapshot(payload);
    }
    catch {
        return null;
    }
}
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
