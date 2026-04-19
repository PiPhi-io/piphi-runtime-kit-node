import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeRegistry } from "../dist/runtime/registry.js";
import { assertIsoTimestamp } from "./helpers.mjs";

test("RuntimeRegistry.get returns undefined for missing entries", () => {
  const registry = new RuntimeRegistry();
  assert.equal(registry.get("missing"), undefined);
});

test("RuntimeRegistry.set and get round-trip entries", () => {
  const registry = new RuntimeRegistry();
  const entry = { latestState: { ok: true } };
  registry.set("entry-1", entry);
  assert.equal(registry.get("entry-1"), entry);
});

test("RuntimeRegistry.ids preserves insertion order", () => {
  const registry = new RuntimeRegistry();
  registry.set("entry-a", {});
  registry.set("entry-b", {});
  assert.deepEqual(registry.ids(), ["entry-a", "entry-b"]);
});

test("RuntimeRegistry.remove returns undefined for missing entries", () => {
  const registry = new RuntimeRegistry();
  assert.equal(registry.remove("missing"), undefined);
});

test("RuntimeRegistry.remove returns the removed entry", () => {
  const registry = new RuntimeRegistry();
  const entry = { latestState: { humidity: 45 } };
  registry.set("entry-2", entry);
  assert.equal(registry.remove("entry-2"), entry);
  assert.equal(registry.get("entry-2"), undefined);
});

test("RuntimeRegistry.remove clears state snapshots", () => {
  const registry = new RuntimeRegistry();
  registry.set("entry-3", {});
  registry.updateState("entry-3", { temperature: 22 });
  registry.remove("entry-3");
  assert.equal(registry.stateSnapshots.has("entry-3"), false);
});

test("RuntimeRegistry.primaryEntry returns undefined when empty", () => {
  const registry = new RuntimeRegistry();
  assert.equal(registry.primaryEntry(), undefined);
});

test("RuntimeRegistry.primaryEntry returns the first inserted entry", () => {
  const registry = new RuntimeRegistry();
  const first = { latestState: { first: true } };
  registry.set("first", first);
  registry.set("second", { latestState: { second: true } });
  assert.equal(registry.primaryEntry(), first);
});

test("RuntimeRegistry.updateState stores a snapshot", () => {
  const registry = new RuntimeRegistry();
  const snapshot = registry.updateState("entry-4", { ppm: 12 });
  assert.equal(snapshot.deviceId, "entry-4");
  assert.deepEqual(snapshot.state, { ppm: 12 });
  assertIsoTimestamp(snapshot.lastUpdated);
  assert.equal(registry.stateSnapshots.get("entry-4")?.deviceId, "entry-4");
});

test("RuntimeRegistry.updateState uses the entry deviceId when present", () => {
  const registry = new RuntimeRegistry();
  registry.set("cfg-1", { deviceId: "sensor-1" });
  const snapshot = registry.updateState("cfg-1", { ppm: 18 });
  assert.equal(snapshot.deviceId, "sensor-1");
  assert.equal(registry.stateSnapshots.get("cfg-1")?.deviceId, "sensor-1");
});

test("RuntimeRegistry.updateState updates matching entry metadata", () => {
  const registry = new RuntimeRegistry();
  const entry = {};
  registry.set("entry-5", entry);
  const snapshot = registry.updateState("entry-5", { humidity: 51 });
  assert.deepEqual(entry.latestState, { humidity: 51 });
  assert.equal(entry.lastUpdated, snapshot.lastUpdated);
});

test("RuntimeRegistry.updateState still stores snapshots without a matching entry", () => {
  const registry = new RuntimeRegistry();
  registry.updateState("entry-6", { voc: 18 });
  assert.deepEqual(registry.stateSnapshots.get("entry-6")?.state, { voc: 18 });
});

test("RuntimeRegistry.appendEvent adds receivedAt metadata", () => {
  const registry = new RuntimeRegistry();
  const event = registry.appendEvent({ eventType: "device.configured" });
  assert.equal(event.eventType, "device.configured");
  assertIsoTimestamp(event.receivedAt);
});

test("RuntimeRegistry.appendEvent trims older events above the max", () => {
  const registry = new RuntimeRegistry(2);
  registry.appendEvent({ eventType: "one" });
  registry.appendEvent({ eventType: "two" });
  registry.appendEvent({ eventType: "three" });
  assert.deepEqual(
    registry.recentEvents.map((event) => event.eventType),
    ["two", "three"],
  );
});

test("RuntimeRegistry.appendEvent keeps events when under the max", () => {
  const registry = new RuntimeRegistry(3);
  registry.appendEvent({ eventType: "one" });
  registry.appendEvent({ eventType: "two" });
  assert.equal(registry.recentEvents.length, 2);
});

test("RuntimeRegistry can maintain multiple independent snapshots", () => {
  const registry = new RuntimeRegistry();
  registry.updateState("entry-a", { value: 1 });
  registry.updateState("entry-b", { value: 2 });
  assert.deepEqual(registry.stateSnapshots.get("entry-a")?.state, { value: 1 });
  assert.deepEqual(registry.stateSnapshots.get("entry-b")?.state, { value: 2 });
});
