import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeStarter } from "../dist/index.js";

test("state service refreshes through one provider and builds a receipt", async () => {
  const starter = createRuntimeStarter({
    integrationId: "demo",
    integrationName: "Demo",
  });
  starter.state.provide(async () => {
    starter.state.publish("device-1", { is_on: true });
  }, { source: "device_api" });

  const payload = await starter.state.response({
    refresh: true,
    refreshRequestId: "request-1",
  });

  assert.deepEqual(payload.entries["device-1"].latest_state, { is_on: true });
  assert.equal(payload.refresh.request_id, "request-1");
  assert.equal(payload.refresh.performed, true);
  assert.equal(payload.refresh.status, "refreshed");
  assert.equal(payload.refresh.source, "device_api");
});

test("state service reports unsupported when no provider is registered", async () => {
  const starter = createRuntimeStarter({
    integrationId: "push-only",
    integrationName: "Push only",
  });
  starter.state.publish("device-1", { value: 7 });

  const payload = await starter.state.response({
    refresh: true,
    refreshRequestId: "request-2",
  });

  assert.deepEqual(payload.refresh, {
    request_id: "request-2",
    performed: false,
    status: "unsupported",
    message: "This integration does not support on-demand state refresh.",
  });
});

test("state service uses config identity without leaking runtime config", async () => {
  const starter = createRuntimeStarter({ integrationId: "demo", integrationName: "Demo" });
  starter.registry.set("device-1", {
    configId: "config-1",
    deviceId: "device-1",
    config: { apiKey: "secret" },
    pollTask: { internal: true },
  });
  starter.state.publish("device-1", { isOn: true });

  const payload = await starter.state.response();
  assert.deepEqual(Object.keys(payload.entries), ["config-1"]);
  assert.deepEqual(payload.entries["config-1"].latest_state, { isOn: true });
  assert.equal("config" in payload.entries["config-1"], false);
  assert.equal("pollTask" in payload.entries["config-1"], false);
});
