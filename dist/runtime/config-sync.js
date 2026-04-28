import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRuntimeAuthHeaders } from "./auth.js";
export const CORE_BASE_URL_ENV_NAME = "PIPHI_CORE_BASE_URL";
export const RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export const RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME = "PIPHI_CONFIG_SNAPSHOT_PATH";
export const DEFAULT_RUNTIME_VOLUME_DIR = "/.piphinetwork";
export const DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME = "configs.json";
export const CORE_RUNTIME_CONFIG_FETCH_PATH = "/api/v2/integrations/config/fetch/all/by/container/internal";
function emptyRehydrateResult() {
    return {
        snapshotFound: false,
        snapshotApplied: false,
        snapshotConfigCount: 0,
        snapshotGeneration: null,
        coreAttempted: false,
        coreApplied: false,
        coreConfigCount: 0,
        coreGeneration: null,
        coreError: null,
        missingRuntimeAuth: false,
    };
}
function normalizeError(error) {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }
    return String(error);
}
function defaultMapConfig(config) {
    return config;
}
function mapSnapshotConfigs(snapshot, mapConfig, reason) {
    return {
        ...snapshot,
        reason: snapshot.reason ?? reason,
        configs: snapshot.configs.map((config) => mapConfig(config)),
    };
}
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
export function buildRuntimeConfigSnapshotFromCoreRows(rows, options) {
    const mapConfig = options.mapConfig ?? (defaultMapConfig);
    const configs = rows.flatMap((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
            return [];
        }
        const configData = row.config_data;
        if (!configData || typeof configData !== "object" || Array.isArray(configData)) {
            return [];
        }
        return [
            mapConfig({
                ...configData,
                containerId: configData.containerId
                    ?? configData.container_id
                    ?? options.containerId,
            }),
        ];
    });
    return {
        containerId: options.containerId,
        reason: options.reason ?? "startup_rehydrate",
        configs,
    };
}
export async function fetchCoreRuntimeConfigSnapshot(options) {
    const { containerId, internalToken } = options.runtimeContext.auth.resolve();
    if (!containerId || !internalToken) {
        return null;
    }
    const coreBaseUrl = resolveCoreBaseUrl({
        defaultValue: options.coreBaseUrl ?? "http://127.0.0.1:31419",
    });
    if (!coreBaseUrl) {
        return null;
    }
    const coreFetch = options.coreFetch ?? fetch;
    const controller = options.timeoutMs ? new AbortController() : null;
    const timeout = controller
        ? setTimeout(() => controller.abort(), options.timeoutMs)
        : null;
    try {
        const url = new URL(`${coreBaseUrl}${CORE_RUNTIME_CONFIG_FETCH_PATH}`);
        url.searchParams.set("container_id", containerId);
        const requestInit = {
            headers: buildRuntimeAuthHeaders({ containerId, internalToken }),
        };
        if (controller) {
            requestInit.signal = controller.signal;
        }
        const response = await coreFetch(url, requestInit);
        if (!response.ok) {
            throw new Error(`Core runtime config fetch failed with HTTP ${response.status}`);
        }
        const rows = await response.json();
        if (!Array.isArray(rows) || rows.length === 0) {
            return null;
        }
        const buildOptions = { containerId };
        if (options.mapConfig) {
            buildOptions.mapConfig = options.mapConfig;
        }
        if (options.reason) {
            buildOptions.reason = options.reason;
        }
        return buildRuntimeConfigSnapshotFromCoreRows(rows, buildOptions);
    }
    finally {
        if (timeout) {
            clearTimeout(timeout);
        }
    }
}
export async function rehydrateRuntimeConfigs(options) {
    const result = emptyRehydrateResult();
    const mapConfig = options.mapConfig ?? (defaultMapConfig);
    const loadOptions = {
        containerId: options.runtimeContext.auth.containerId,
    };
    if (options.snapshotPath) {
        loadOptions.path = options.snapshotPath;
    }
    if (options.snapshotVolumeDir) {
        loadOptions.volumeDir = options.snapshotVolumeDir;
    }
    const snapshot = loadRuntimeConfigSnapshot(loadOptions);
    if (snapshot) {
        result.snapshotFound = true;
        const mappedSnapshot = mapSnapshotConfigs(snapshot, mapConfig, options.snapshotReason ?? "startup_snapshot_rehydrate");
        await options.applySnapshot(mappedSnapshot);
        result.snapshotApplied = true;
        result.snapshotConfigCount = mappedSnapshot.configs.length;
        result.snapshotGeneration = mappedSnapshot.generation ?? null;
    }
    const { containerId, internalToken } = options.runtimeContext.auth.resolve();
    if (!containerId || !internalToken) {
        result.missingRuntimeAuth = true;
        return result;
    }
    result.coreAttempted = true;
    try {
        const fetchOptions = {
            runtimeContext: options.runtimeContext,
            mapConfig,
            reason: options.coreReason ?? "startup_rehydrate",
        };
        if (options.coreFetch) {
            fetchOptions.coreFetch = options.coreFetch;
        }
        if (options.coreBaseUrl !== undefined) {
            fetchOptions.coreBaseUrl = options.coreBaseUrl;
        }
        if (options.timeoutMs !== undefined) {
            fetchOptions.timeoutMs = options.timeoutMs;
        }
        const coreSnapshot = await fetchCoreRuntimeConfigSnapshot(fetchOptions);
        if (!coreSnapshot) {
            return result;
        }
        await options.applySnapshot(coreSnapshot);
        result.coreApplied = true;
        result.coreConfigCount = coreSnapshot.configs.length;
        result.coreGeneration = coreSnapshot.generation ?? null;
        return result;
    }
    catch (error) {
        result.coreError = normalizeError(error);
        if (options.raiseCoreErrors) {
            throw error;
        }
        return result;
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
