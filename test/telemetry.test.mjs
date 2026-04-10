import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeAuthContext } from "../dist/runtime/auth.js";
import {
  CoreRouteNotFoundError,
  CoreTimeoutError,
  CoreUnavailableError,
} from "../dist/runtime/errors.js";
import { RuntimeProcessState } from "../dist/runtime/state.js";
import { TelemetryClient, buildCoreAuthHeaders } from "../dist/runtime/telemetry.js";

test("buildCoreAuthHeaders resolves auth context values", () => {
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "container-1", internalToken: "token-1" });
  assert.deepEqual(buildCoreAuthHeaders(auth), {
    "x-container-id": "container-1",
    "x-piphi-integration-token": "token-1",
  });
});

test("TelemetryClient normalizes trailing slashes and /api/v2 from coreBaseUrl", async () => {
  const state = new RuntimeProcessState();
  let capturedUrl = "";
  state.setCoreFetch(async (url) => {
    capturedUrl = String(url);
    return new Response(null, { status: 200 });
  });
  const client = new TelemetryClient({
    processState: state,
    coreBaseUrl: "http://core.example/api/v2/",
  });
  await client.sendMetrics({
    authContext: new RuntimeAuthContext(),
    deviceId: "device-1",
    metrics: { temperature: 22.1 },
  });
  assert.equal(capturedUrl, "http://core.example/api/v2/integrations/telemetry");
});

test("TelemetryClient sends a minimal telemetry payload", async () => {
  const state = new RuntimeProcessState();
  let requestInit;
  state.setCoreFetch(async (_url, init) => {
    requestInit = init;
    return new Response(null, { status: 200 });
  });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: new RuntimeAuthContext(),
    deviceId: "device-2",
    metrics: { humidity: 48 },
  });
  assert.equal(requestInit.method, "POST");
  assert.deepEqual(JSON.parse(requestInit.body), {
    deviceId: "device-2",
    metrics: { humidity: 48 },
  });
});

test("TelemetryClient sends units when provided", async () => {
  const state = new RuntimeProcessState();
  let body;
  state.setCoreFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(null, { status: 200 });
  });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: new RuntimeAuthContext(),
    deviceId: "device-3",
    metrics: { temperature: 21.8 },
    units: { temperature: "C" },
  });
  assert.deepEqual(body.units, { temperature: "C" });
});

test("TelemetryClient uses an explicit containerId when provided", async () => {
  const state = new RuntimeProcessState();
  let body;
  state.setCoreFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(null, { status: 200 });
  });
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "auth-container" });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: auth,
    deviceId: "device-4",
    metrics: { pressure: 101.2 },
    containerId: "explicit-container",
  });
  assert.equal(body.containerId, "explicit-container");
});

test("TelemetryClient falls back to auth context containerId", async () => {
  const state = new RuntimeProcessState();
  let body;
  state.setCoreFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(null, { status: 200 });
  });
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "context-container" });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: auth,
    deviceId: "device-5",
    metrics: { battery: 91 },
  });
  assert.equal(body.containerId, "context-container");
});

test("TelemetryClient omits containerId when no explicit or auth value exists", async () => {
  const state = new RuntimeProcessState();
  let body;
  state.setCoreFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(null, { status: 200 });
  });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: new RuntimeAuthContext(),
    deviceId: "device-6",
    metrics: { co2: 400 },
  });
  assert.equal("containerId" in body, false);
});

test("TelemetryClient includes integrationId when explicitly provided", async () => {
  const state = new RuntimeProcessState();
  let body;
  state.setCoreFetch(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(null, { status: 200 });
  });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: new RuntimeAuthContext(),
    deviceId: "device-7",
    metrics: { voc: 12 },
    integrationId: "integration-7",
  });
  assert.equal(body.integrationId, "integration-7");
});

test("TelemetryClient uses processState.coreFetch before global fetch", async () => {
  const state = new RuntimeProcessState();
  let localUsed = false;
  state.setCoreFetch(async () => {
    localUsed = true;
    return new Response(null, { status: 200 });
  });
  globalThis.fetch = async () => {
    throw new Error("global fetch should not be used");
  };
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: new RuntimeAuthContext(),
    deviceId: "device-8",
    metrics: { value: 1 },
  });
  assert.equal(localUsed, true);
});

test("TelemetryClient falls back to global fetch when coreFetch is not bound", async () => {
  const state = new RuntimeProcessState();
  let called = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    called = true;
    return new Response(null, { status: 200 });
  };
  try {
    const client = new TelemetryClient({ processState: state });
    await client.sendMetrics({
      authContext: new RuntimeAuthContext(),
      deviceId: "device-9",
      metrics: { value: 2 },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(called, true);
});

test("TelemetryClient includes runtime auth headers", async () => {
  const state = new RuntimeProcessState();
  let headers;
  state.setCoreFetch(async (_url, init) => {
    headers = init.headers;
    return new Response(null, { status: 200 });
  });
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "container-10", internalToken: "token-10" });
  const client = new TelemetryClient({ processState: state });
  await client.sendMetrics({
    authContext: auth,
    deviceId: "device-10",
    metrics: { value: 10 },
  });
  assert.deepEqual(headers, {
    "content-type": "application/json",
    "x-container-id": "container-10",
    "x-piphi-integration-token": "token-10",
  });
});

test("TelemetryClient maps a 404 response to CoreRouteNotFoundError", async () => {
  const state = new RuntimeProcessState();
  state.setCoreFetch(async () => new Response(null, { status: 404 }));
  const client = new TelemetryClient({ processState: state });
  await assert.rejects(
    client.sendMetrics({
      authContext: new RuntimeAuthContext(),
      deviceId: "device-11",
      metrics: { value: 11 },
    }),
    CoreRouteNotFoundError,
  );
});

test("TelemetryClient maps AbortError to CoreTimeoutError", async () => {
  const state = new RuntimeProcessState();
  state.setCoreFetch(async () => {
    throw new DOMException("aborted", "AbortError");
  });
  const client = new TelemetryClient({ processState: state, timeoutMs: 50 });
  await assert.rejects(
    client.sendMetrics({
      authContext: new RuntimeAuthContext(),
      deviceId: "device-12",
      metrics: { value: 12 },
    }),
    CoreTimeoutError,
  );
});

test("TelemetryClient maps unknown transport errors to CoreUnavailableError", async () => {
  const state = new RuntimeProcessState();
  state.setCoreFetch(async () => {
    throw new Error("connection refused");
  });
  const client = new TelemetryClient({ processState: state });
  await assert.rejects(
    client.sendMetrics({
      authContext: new RuntimeAuthContext(),
      deviceId: "device-13",
      metrics: { value: 13 },
    }),
    CoreUnavailableError,
  );
});

test("TelemetryClient rethrows already-classified errors unchanged", async () => {
  const state = new RuntimeProcessState();
  const classified = new CoreUnavailableError({
    operation: "telemetry_delivery",
    url: "http://core.test/telemetry",
    message: "PiPhi Core is unreachable",
    retryable: true,
  });
  state.setCoreFetch(async () => {
    throw classified;
  });
  const client = new TelemetryClient({ processState: state });
  await assert.rejects(
    client.sendMetrics({
      authContext: new RuntimeAuthContext(),
      deviceId: "device-14",
      metrics: { value: 14 },
    }),
    (error) => error === classified,
  );
});
