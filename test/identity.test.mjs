import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRuntimeIdentity,
  resolveConfigId,
  resolveDeviceId,
} from "../dist/runtime/identity.js";

test("identity helpers prefer explicit configId and deviceId", () => {
  const config = {
    id: "core-config-uuid",
    configId: "core-config-uuid",
    deviceId: "vendor-device-42",
    containerId: "container-1",
    integrationId: "demo-runtime",
  };

  assert.equal(resolveConfigId(config), "core-config-uuid");
  assert.equal(resolveDeviceId(config), "vendor-device-42");
  assert.deepEqual(buildRuntimeIdentity(config), {
    configId: "core-config-uuid",
    deviceId: "vendor-device-42",
    containerId: "container-1",
    integrationId: "demo-runtime",
  });
});

test("identity helpers fall back to id", () => {
  assert.equal(resolveConfigId({ id: "core-config-uuid" }), "core-config-uuid");
  assert.equal(resolveDeviceId({ id: "core-config-uuid" }), "core-config-uuid");
});
