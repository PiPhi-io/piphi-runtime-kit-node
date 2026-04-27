import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeContext } from "../dist/runtime/context.js";
import {
  buildRuntimeDiagnosticsResponse,
  buildRuntimeHealthResponse,
} from "../dist/runtime/health.js";
import { RuntimeProcessState } from "../dist/runtime/state.js";
import { RuntimeAuthContext } from "../dist/runtime/auth.js";

test("RuntimeProcessState defaults are sensible", () => {
  const state = new RuntimeProcessState();
  assert.equal(state.currentGeneration, null);
  assert.equal(state.coreBaseUrl, "http://127.0.0.1:31419");
  assert.equal(state.coreFetch, null);
  assert.equal(state.backgroundTasks.size, 0);
});

test("RuntimeProcessState.setCoreFetch stores a fetch implementation", () => {
  const state = new RuntimeProcessState();
  const coreFetch = async () => new Response(null, { status: 200 });
  state.setCoreFetch(coreFetch);
  assert.equal(state.coreFetch, coreFetch);
});

test("RuntimeProcessState.setCurrentGeneration stores the generation", () => {
  const state = new RuntimeProcessState();
  state.setCurrentGeneration(44);
  assert.equal(state.currentGeneration, 44);
});

test("RuntimeContext creates default auth and process state instances", () => {
  const runtime = new RuntimeContext();
  assert.ok(runtime.auth instanceof RuntimeAuthContext);
  assert.ok(runtime.processState instanceof RuntimeProcessState);
});

test("RuntimeContext accepts injected auth and process state", () => {
  const auth = new RuntimeAuthContext();
  const processState = new RuntimeProcessState();
  const runtime = new RuntimeContext({ auth, processState });
  assert.equal(runtime.auth, auth);
  assert.equal(runtime.processState, processState);
});

test("RuntimeContext.setCoreFetch forwards to process state", () => {
  const runtime = new RuntimeContext();
  const coreFetch = async () => new Response(null, { status: 200 });
  runtime.setCoreFetch(coreFetch);
  assert.equal(runtime.processState.coreFetch, coreFetch);
});

test("RuntimeContext.setCurrentGeneration forwards to process state", () => {
  const runtime = new RuntimeContext();
  runtime.setCurrentGeneration(88);
  assert.equal(runtime.processState.currentGeneration, 88);
});

test("buildRuntimeHealthResponse includes default support fields", () => {
  const runtime = new RuntimeContext();
  const response = buildRuntimeHealthResponse(runtime);
  assert.deepEqual(response, {
    ok: true,
    runtimeAuthPresent: false,
    coreClientBound: false,
    pendingTaskCount: 0,
    currentGeneration: null,
    configGeneration: null,
  });
});

test("buildRuntimeHealthResponse includes integration metadata", () => {
  const runtime = new RuntimeContext();
  runtime.auth.update({ containerId: "container", internalToken: "token" });
  runtime.setCoreFetch(async () => new Response(null, { status: 200 }));
  runtime.processState.backgroundTasks.add(Promise.resolve());
  const response = buildRuntimeHealthResponse(runtime, {
    integration: { id: "integration-1" },
    metadata: { activeConfigs: 3 },
  });
  assert.equal(response.runtimeAuthPresent, true);
  assert.equal(response.coreClientBound, true);
  assert.equal(response.pendingTaskCount, 1);
  assert.deepEqual(response.integration, { id: "integration-1" });
  assert.deepEqual(response.metadata, { activeConfigs: 3 });
});

test("buildRuntimeHealthResponse remains false when only one auth value exists", () => {
  const runtime = new RuntimeContext();
  runtime.auth.update({ containerId: "container-only" });
  assert.equal(buildRuntimeHealthResponse(runtime).runtimeAuthPresent, false);
});

test("buildRuntimeDiagnosticsResponse includes optional diagnostics", () => {
  const runtime = new RuntimeContext();
  runtime.setCurrentGeneration(5);
  const response = buildRuntimeDiagnosticsResponse(runtime, {
    integration: { id: "integration-2" },
    diagnostics: { recentEventCount: 10 },
  });
  assert.deepEqual(response.integration, { id: "integration-2" });
  assert.deepEqual(response.diagnostics, { recentEventCount: 10 });
  assert.equal(response.currentGeneration, 5);
});

test("buildRuntimeDiagnosticsResponse defaults fields the same way as health", () => {
  const runtime = new RuntimeContext();
  assert.deepEqual(buildRuntimeDiagnosticsResponse(runtime), {
    ok: true,
    runtimeAuthPresent: false,
    coreClientBound: false,
    pendingTaskCount: 0,
    currentGeneration: null,
    configGeneration: null,
  });
});
