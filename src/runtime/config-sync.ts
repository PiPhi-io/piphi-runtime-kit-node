import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { RuntimeConfig, RuntimeConfigSnapshot, RuntimeConfigSyncResponse } from "../types.js";
import { RuntimeProcessState } from "./state.js";

type RuntimeEnv = Record<string, string | undefined>;

declare const process: { env: RuntimeEnv };

export const CORE_BASE_URL_ENV_NAME = "PIPHI_CORE_BASE_URL";
export const RUNTIME_CONTAINER_ID_ENV_NAME = "PIPHI_CONTAINER_ID";
export const RUNTIME_CONFIG_SNAPSHOT_PATH_ENV_NAME = "PIPHI_CONFIG_SNAPSHOT_PATH";
export const DEFAULT_RUNTIME_VOLUME_DIR = "/.piphinetwork";
export const DEFAULT_RUNTIME_CONFIG_SNAPSHOT_FILENAME = "configs.json";

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
