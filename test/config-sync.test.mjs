import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ConfigSyncCoordinator,
  buildSyncResponse,
  loadRuntimeConfigSnapshot,
  resolveCoreBaseUrl,
  resolveRuntimeConfigSnapshotPath,
  reconcileConfigIds,
} from "../dist/runtime/config-sync.js";
import { RuntimeProcessState } from "../dist/runtime/state.js";

for (const [label, incoming, active, expected] of [
  ["empty incoming", [], ["a", "b"], { toKeep: [], toRemove: ["a", "b"] }],
  ["identical sets", ["a", "b"], ["a", "b"], { toKeep: ["a", "b"], toRemove: [] }],
  ["partial overlap", ["b", "c"], ["a", "b"], { toKeep: ["b"], toRemove: ["a"] }],
  ["no active ids", ["x"], [], { toKeep: [], toRemove: [] }],
]) {
  test(`reconcileConfigIds handles ${label}`, () => {
    assert.deepEqual(reconcileConfigIds(incoming, active), expected);
  });
}

test("buildSyncResponse provides defaults", () => {
  assert.deepEqual(buildSyncResponse(), {
    ok: true,
    appliedConfigIds: [],
    removedConfigIds: [],
    skippedConfigIds: [],
    generation: null,
  });
});

test("buildSyncResponse preserves provided values", () => {
  assert.deepEqual(
    buildSyncResponse({
      appliedConfigIds: ["a"],
      removedConfigIds: ["b"],
      skippedConfigIds: ["c"],
      generation: 7,
    }),
    {
      ok: true,
      appliedConfigIds: ["a"],
      removedConfigIds: ["b"],
      skippedConfigIds: ["c"],
      generation: 7,
    },
  );
});

test("resolveCoreBaseUrl uses managed runtime environment", () => {
  assert.equal(
    resolveCoreBaseUrl({ env: { PIPHI_CORE_BASE_URL: "http://127.0.0.1:31419/" } }),
    "http://127.0.0.1:31419",
  );
});

test("resolveRuntimeConfigSnapshotPath uses explicit path or container id", () => {
  assert.equal(
    resolveRuntimeConfigSnapshotPath({
      env: { PIPHI_CONFIG_SNAPSHOT_PATH: "/tmp/runtime-config.json" },
      volumeDir: "/ignored",
    }),
    "/tmp/runtime-config.json",
  );
  assert.equal(
    resolveRuntimeConfigSnapshotPath({
      env: { PIPHI_CONTAINER_ID: "container-1" },
      volumeDir: "/.piphinetwork",
    }),
    "/.piphinetwork/container-1.json",
  );
});

test("loadRuntimeConfigSnapshot reads Core volume contract", () => {
  const dir = mkdtempSync(join(tmpdir(), "piphi-runtime-"));
  const path = join(dir, "container-1.json");
  writeFileSync(
    path,
    JSON.stringify({
      schema_version: 1,
      container_id: "container-1",
      integration_id: "integration-1",
      driver_pid: 123,
      reason: "startup",
      generation: 42,
      updated_at: "2026-04-27T12:00:00+00:00",
      configs: [{ id: "device-1", serial: "abc123" }],
      deleted_config_ids: ["device-2"],
      config_hash: "sha256:abc",
      internal_token: "runtime-token",
    }),
    "utf-8",
  );

  const snapshot = loadRuntimeConfigSnapshot({ path });

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.containerId, "container-1");
  assert.equal(snapshot.integrationId, "integration-1");
  assert.equal(snapshot.driverPid, 123);
  assert.equal(snapshot.generation, 42);
  assert.deepEqual(snapshot.deletedConfigIds, ["device-2"]);
  assert.equal(snapshot.configHash, "sha256:abc");
  assert.equal(snapshot.internalToken, "runtime-token");
  assert.deepEqual(snapshot.configs, [{ id: "device-1", serial: "abc123" }]);
});

test("loadRuntimeConfigSnapshot returns null for missing or invalid snapshots", () => {
  const dir = mkdtempSync(join(tmpdir(), "piphi-runtime-"));
  const path = join(dir, "invalid.json");
  writeFileSync(path, "not-json", "utf-8");

  assert.equal(loadRuntimeConfigSnapshot({ path: join(dir, "missing.json") }), null);
  assert.equal(loadRuntimeConfigSnapshot({ path }), null);
});

test("ConfigSyncCoordinator.applySnapshot applies configs and removes stale ones", async () => {
  const state = new RuntimeProcessState();
  const coordinator = new ConfigSyncCoordinator(state);
  const applied = [];
  const removed = [];
  const response = await coordinator.applySnapshot(
    {
      generation: 12,
      configs: [{ id: "cfg-1" }, { id: "cfg-2" }],
    },
    {
      activeConfigIds: ["cfg-1", "cfg-3"],
      applyConfig: async (config) => {
        applied.push(config.id);
      },
      removeConfig: async (configId) => {
        removed.push(configId);
        return true;
      },
    },
  );
  assert.deepEqual(applied, ["cfg-1", "cfg-2"]);
  assert.deepEqual(removed, ["cfg-3"]);
  assert.deepEqual(response, {
    ok: true,
    appliedConfigIds: ["cfg-1", "cfg-2"],
    removedConfigIds: ["cfg-3"],
    skippedConfigIds: [],
    generation: 12,
  });
  assert.equal(state.currentGeneration, 12);
});

test("ConfigSyncCoordinator.applySnapshot uses getActiveConfigIds when provided", async () => {
  const coordinator = new ConfigSyncCoordinator(new RuntimeProcessState());
  const removed = [];
  const response = await coordinator.applySnapshot(
    { generation: 20, configs: [{ id: "cfg-a" }] },
    {
      activeConfigIds: ["unused"],
      getActiveConfigIds: () => ["cfg-a", "cfg-b"],
      applyConfig: async () => {},
      removeConfig: async (configId) => {
        removed.push(configId);
        return true;
      },
    },
  );
  assert.deepEqual(removed, ["cfg-b"]);
  assert.deepEqual(response.removedConfigIds, ["cfg-b"]);
});

test("ConfigSyncCoordinator.applySnapshot marks failed removals as skipped", async () => {
  const coordinator = new ConfigSyncCoordinator(new RuntimeProcessState());
  const response = await coordinator.applySnapshot(
    { generation: 21, configs: [] },
    {
      activeConfigIds: ["cfg-z"],
      applyConfig: async () => {},
      removeConfig: async () => false,
    },
  );
  assert.deepEqual(response.removedConfigIds, []);
  assert.deepEqual(response.skippedConfigIds, ["cfg-z"]);
});

test("ConfigSyncCoordinator.applySnapshot handles null generation", async () => {
  const state = new RuntimeProcessState();
  const coordinator = new ConfigSyncCoordinator(state);
  const response = await coordinator.applySnapshot(
    { generation: null, configs: [] },
    {
      activeConfigIds: [],
      applyConfig: async () => {},
      removeConfig: async () => true,
    },
  );
  assert.equal(response.generation, null);
  assert.equal(state.currentGeneration, null);
});

test("ConfigSyncCoordinator.applySnapshot supports empty snapshot removal-only flows", async () => {
  const coordinator = new ConfigSyncCoordinator(new RuntimeProcessState());
  const removed = [];
  const response = await coordinator.applySnapshot(
    { generation: 99, configs: [] },
    {
      activeConfigIds: ["cfg-10", "cfg-11"],
      applyConfig: async () => {},
      removeConfig: async (configId) => {
        removed.push(configId);
        return true;
      },
    },
  );
  assert.deepEqual(removed, ["cfg-10", "cfg-11"]);
  assert.deepEqual(response.removedConfigIds, ["cfg-10", "cfg-11"]);
});
