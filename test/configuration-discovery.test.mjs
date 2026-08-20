import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConfigApplyResponse,
  buildConfigRemoveResponse,
  formatConfigApplyLog,
  redactConfigSecrets,
  validateTypedConfig,
  validateTypedConfigs,
} from "../dist/runtime/configuration.js";
import {
  buildDiscoveryResponse,
  formatDiscoveryAttemptLog,
  normalizeDiscoveryInputs,
} from "../dist/runtime/discovery.js";

test("redactConfigSecrets redacts all default secret keys", () => {
  assert.deepEqual(
    redactConfigSecrets({
      password: "pw",
      token: "tok",
      secret: "sec",
      apiKey: "key",
      api_key: "snake",
      host: "127.0.0.1",
    }),
    {
      password: "***redacted***",
      token: "***redacted***",
      secret: "***redacted***",
      apiKey: "***redacted***",
      api_key: "***redacted***",
      host: "127.0.0.1",
    },
  );
});

test("redactConfigSecrets recursively protects nested objects and arrays", () => {
  const config = { nested: { token: "inside" }, entries: [{ access_token: "secret" }], alias: "Office" };
  assert.deepEqual(redactConfigSecrets(config), {
    nested: { token: "***redacted***" },
    entries: [{ access_token: "***redacted***" }],
    alias: "Office",
  });
});

test("formatConfigApplyLog redacts secrets and includes ids", () => {
  const line = formatConfigApplyLog({
    id: "cfg-1",
    containerId: "container-1",
    integrationId: "integration-1",
    password: "test-password",
  });
  assert.match(line, /^config_apply /);
  assert.match(line, /config_id=cfg-1/);
  assert.match(line, /container_id=container-1/);
  assert.match(line, /integration_id=integration-1/);
  assert.match(line, /"password":"\*\*\*redacted\*\*\*"/);
});

test("formatConfigApplyLog uses missing placeholders", () => {
  const line = formatConfigApplyLog({ id: "cfg-2" });
  assert.match(line, /container_id=<missing>/);
  assert.match(line, /integration_id=<missing>/);
});

test("buildConfigApplyResponse returns an ok payload", () => {
  assert.deepEqual(
    buildConfigApplyResponse({ configId: "cfg-3", metadata: { alias: "Lab" } }),
    {
      ok: true,
      configId: "cfg-3",
      metadata: { alias: "Lab" },
    },
  );
});

test("buildConfigRemoveResponse returns an ok payload", () => {
  assert.deepEqual(
    buildConfigRemoveResponse({ configId: "cfg-4", removed: true }),
    {
      ok: true,
      configId: "cfg-4",
      removed: true,
    },
  );
});

test("validateTypedConfig accepts validator functions and parse schemas", () => {
  const validate = (payload) => {
    if (!payload || typeof payload.host !== "string") throw new TypeError("host is required");
    return { host: payload.host.trim() };
  };
  assert.deepEqual(validateTypedConfig({ host: " device.local " }, validate), { host: "device.local" });
  assert.deepEqual(validateTypedConfig({ port: 443 }, { parse: (value) => ({ port: Number(value.port) }) }), { port: 443 });
  assert.throws(() => validateTypedConfig({}, validate), /host is required/);
});

test("validateTypedConfigs validates every config and preserves ordering", () => {
  assert.deepEqual(
    validateTypedConfigs([{ id: "a" }, { id: "b" }], (payload) => ({ id: payload.id.toUpperCase() })),
    [{ id: "A" }, { id: "B" }],
  );
});

test("normalizeDiscoveryInputs trims and keeps non-empty strings", () => {
  assert.deepEqual(
    normalizeDiscoveryInputs({
      host: " 10.0.0.5 ",
      alias: " Office ",
      empty: "   ",
    }),
    {
      host: "10.0.0.5",
      alias: "Office",
    },
  );
});

test("normalizeDiscoveryInputs drops undefined and null values", () => {
  assert.deepEqual(
    normalizeDiscoveryInputs({
      a: undefined,
      b: null,
      c: "value",
    }),
    { c: "value" },
  );
});

test("normalizeDiscoveryInputs preserves falsey but meaningful values", () => {
  assert.deepEqual(
    normalizeDiscoveryInputs({
      includeOffline: false,
      limit: 0,
      tags: [],
    }),
    {
      includeOffline: false,
      limit: 0,
      tags: [],
    },
  );
});

test("normalizeDiscoveryInputs handles undefined input", () => {
  assert.deepEqual(normalizeDiscoveryInputs(undefined), {});
});

test("buildDiscoveryResponse works with arrays", () => {
  assert.deepEqual(buildDiscoveryResponse([{ id: "device-1" }]), {
    devices: [{ id: "device-1" }],
  });
});

test("buildDiscoveryResponse works with sets and other iterables", () => {
  const devices = new Set([{ id: "device-2" }, { id: "device-3" }]);
  assert.equal(buildDiscoveryResponse(devices).devices.length, 2);
});

test("formatDiscoveryAttemptLog sorts input keys", () => {
  const line = formatDiscoveryAttemptLog({ z: true, a: true, m: true });
  assert.match(line, /input_keys=\["a","m","z"\]/);
});

test("formatDiscoveryAttemptLog records credential presence booleans", () => {
  const line = formatDiscoveryAttemptLog({
    username: "user",
    email: "",
    password: "pw",
  });
  assert.match(line, /uses_username=true/);
  assert.match(line, /uses_email=false/);
  assert.match(line, /uses_password=true/);
});
