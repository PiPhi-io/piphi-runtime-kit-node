import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigSyncCoordinator,
  buildSyncResponse,
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
