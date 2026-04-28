import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { RuntimeConfig, RuntimeConfigSnapshot, RuntimeConfigSyncResponse } from "../types.js";
import { buildRuntimeAuthHeaders } from "./auth.js";
import type { RuntimeContext } from "./context.js";
import { RuntimeProcessState } from "./state.js";

type RuntimeEnv = Record<string, string | undefined>;

declare const process: { env: RuntimeEnv };

export const CORE_BASE_URL_ENV_NAME = "PIPHI_CORE_BASE_URL";
export const RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export const RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME = "PIPHI_CONFIG_SNAPSHOT_PATH";
export const DEFAULT_RUNTIME_VOLUME_DIR = "/.piphinetwork";
export const DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME = "configs.json";
export const CORE_RUNTIME_CONFIG_FETCH_PATH = "/api/v2/integrations/config/fetch/all/by/container/internal";

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

function emptyRehydrateResult(): RuntimeConfigRehydrateResult {
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

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function defaultMapConfig<TConfig extends RuntimeConfig>(
  config: RuntimeConfig & Record<string, unknown>,
): TConfig {
  return config as TConfig;
}

function mapSnapshotConfigs<TConfig extends RuntimeConfig>(
  snapshot: RuntimeConfigSnapshot<RuntimeConfig>,
  mapConfig: (config: RuntimeConfig & Record<string, unknown>) => TConfig,
  reason: string,
): RuntimeConfigSnapshot<TConfig> {
  return {
    ...snapshot,
    reason: snapshot.reason ?? reason,
    configs: snapshot.configs.map((config) => mapConfig(config as RuntimeConfig & Record<string, unknown>)),
  };
}

function getString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getNumber(payload: Record<string, unknown>, ...keys: string[]): number | null {
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

function getStringArray(payload: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((item) => item.trim());
    }
  }
  return [];
}

export function resolveCoreBaseUrl(options: {
  env?: RuntimeEnv;
  defaultValue?: string | null;
} = {}): string | null {
  const env = options.env ?? process.env;
  const value = (env[CORE_BASE_URL_ENV_NAME] ?? "").trim().replace(/\/+$/, "");
  if (value) {
    return value;
  }
  const fallback = options.defaultValue?.trim().replace(/\/+$/, "");
  return fallback || null;
}

export function resolveRuntimeConfigSnapshotPath(options: {
  env?: RuntimeEnv;
  containerId?: string | null;
  volumeDir?: string;
} = {}): string {
  const env = options.env ?? process.env;
  const explicitPath = (env[RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME] ?? "").trim();
  if (explicitPath) {
    return explicitPath;
  }

  const containerId = (
    options.containerId?.trim()
    || env[RUNTIME_CONTAINER_ID_ENV_NAME]?.trim()
  );
  const volumeDir = options.volumeDir ?? DEFAULT_RUNTIME_VOLUME_DIR;
  if (containerId) {
    return join(volumeDir, `${containerId}.json`);
  }
  return join(volumeDir, DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME);
}

export function normalizeRuntimeConfigSnapshot<TConfig extends RuntimeConfig = RuntimeConfig>(
  payload: Record<string, unknown>,
): RuntimeConfigSnapshot<TConfig> | null {
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
    configs: configs as TConfig[],
    deletedConfigIds: getStringArray(payload, "deleted_config_ids", "deletedConfigIds"),
    configHash: getString(payload, "config_hash", "configHash"),
    internalToken: getString(payload, "internal_token", "internalToken"),
  };
}

export function loadRuntimeConfigSnapshot<TConfig extends RuntimeConfig = RuntimeConfig>(
  options: {
    path?: string;
    env?: RuntimeEnv;
    containerId?: string | null;
    volumeDir?: string;
  } = {},
): RuntimeConfigSnapshot<TConfig> | null {
  const snapshotPath = options.path ?? resolveRuntimeConfigSnapshotPath(options);
  if (!existsSync(snapshotPath)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(snapshotPath, "utf-8")) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    return normalizeRuntimeConfigSnapshot<TConfig>(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function buildRuntimeConfigSnapshotFromCoreRows<TConfig extends RuntimeConfig = RuntimeConfig>(
  rows: unknown[],
  options: {
    containerId: string;
    mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
    reason?: string;
  },
): RuntimeConfigSnapshot<TConfig> {
  const mapConfig = options.mapConfig ?? defaultMapConfig<TConfig>;
  const configs = rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return [];
    }
    const configData = (row as Record<string, unknown>).config_data;
    if (!configData || typeof configData !== "object" || Array.isArray(configData)) {
      return [];
    }
    return [
      mapConfig({
        ...(configData as RuntimeConfig & Record<string, unknown>),
        containerId: ((configData as Record<string, unknown>).containerId as string | undefined)
          ?? ((configData as Record<string, unknown>).container_id as string | undefined)
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

export async function fetchCoreRuntimeConfigSnapshot<TConfig extends RuntimeConfig = RuntimeConfig>(
  options: {
    runtimeContext: RuntimeContext;
    coreFetch?: typeof fetch;
    coreBaseUrl?: string | null;
    timeoutMs?: number;
    mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
    reason?: string;
  },
): Promise<RuntimeConfigSnapshot<TConfig> | null> {
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
    const requestInit: RequestInit = {
      headers: buildRuntimeAuthHeaders({ containerId, internalToken }),
    };
    if (controller) {
      requestInit.signal = controller.signal;
    }

    const response = await coreFetch(url, requestInit);
    if (!response.ok) {
      throw new Error(`Core runtime config fetch failed with HTTP ${response.status}`);
    }

    const rows = await response.json() as unknown;
    if (!Array.isArray(rows) || rows.length === 0) {
      return null;
    }
    const buildOptions: {
      containerId: string;
      mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
      reason?: string;
    } = { containerId };
    if (options.mapConfig) {
      buildOptions.mapConfig = options.mapConfig;
    }
    if (options.reason) {
      buildOptions.reason = options.reason;
    }

    return buildRuntimeConfigSnapshotFromCoreRows(rows, buildOptions);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function rehydrateRuntimeConfigs<TConfig extends RuntimeConfig = RuntimeConfig>(
  options: RuntimeConfigRehydrateOptions<TConfig>,
): Promise<RuntimeConfigRehydrateResult> {
  const result = emptyRehydrateResult();
  const mapConfig = options.mapConfig ?? defaultMapConfig<TConfig>;
  const loadOptions: {
    path?: string;
    containerId?: string | null;
    volumeDir?: string;
  } = {
    containerId: options.runtimeContext.auth.containerId,
  };
  if (options.snapshotPath) {
    loadOptions.path = options.snapshotPath;
  }
  if (options.snapshotVolumeDir) {
    loadOptions.volumeDir = options.snapshotVolumeDir;
  }
  const snapshot = loadRuntimeConfigSnapshot<RuntimeConfig>(loadOptions);

  if (snapshot) {
    result.snapshotFound = true;
    const mappedSnapshot = mapSnapshotConfigs(
      snapshot,
      mapConfig,
      options.snapshotReason ?? "startup_snapshot_rehydrate",
    );
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
    const fetchOptions: {
      runtimeContext: RuntimeContext;
      coreFetch?: typeof fetch;
      coreBaseUrl?: string | null;
      timeoutMs?: number;
      mapConfig?: (config: RuntimeConfig & Record<string, unknown>) => TConfig;
      reason?: string;
    } = {
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
  } catch (error) {
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
