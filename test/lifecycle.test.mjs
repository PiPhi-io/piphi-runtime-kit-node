import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeContext } from "../dist/runtime/context.js";
import {
  bootstrapRuntimeAuthFromEnv,
  createCoreFetch,
  runRuntimeLifecycle,
  withCoreFetch,
} from "../dist/runtime/lifecycle.js";
import { createTrackedTask } from "../dist/runtime/tasks.js";

test("bootstrapRuntimeAuthFromEnv trims runtime credentials", () => {
  const runtime = new RuntimeContext();
  assert.deepEqual(bootstrapRuntimeAuthFromEnv(runtime, {
    env: {
      PIPHI_CONTAINER_ID: " container-1 ",
      PIPHI_INTEGRATION_INTERNAL_TOKEN: " token-1 ",
    },
  }), { containerId: "container-1", internalToken: "token-1" });
  assert.equal(runtime.auth.containerId, "container-1");
  assert.equal(runtime.auth.internalToken, "token-1");
});

test("bootstrapRuntimeAuthFromEnv supports custom variable names and missing values", () => {
  const runtime = new RuntimeContext();
  assert.deepEqual(bootstrapRuntimeAuthFromEnv(runtime, {
    env: { CUSTOM_CONTAINER: "custom" },
    containerEnvName: "CUSTOM_CONTAINER",
    tokenEnvName: "CUSTOM_TOKEN",
  }), { containerId: "custom", internalToken: "" });
});

test("withCoreFetch always unbinds fetch after success or failure", async () => {
  const runtime = new RuntimeContext();
  const coreFetch = async () => new Response(null, { status: 204 });
  assert.equal(await withCoreFetch(runtime, async (bound) => {
    assert.equal(runtime.processState.coreFetch, bound);
    return "ok";
  }, { coreFetch }), "ok");
  assert.equal(runtime.processState.coreFetch, null);
  await assert.rejects(withCoreFetch(runtime, async () => { throw new Error("failed"); }, { coreFetch }), /failed/);
  assert.equal(runtime.processState.coreFetch, null);
});

test("createCoreFetch supplies a timeout signal but preserves caller signals", async () => {
  const signals = [];
  const coreFetch = createCoreFetch({
    timeoutMs: 100,
    fetchImplementation: async (_input, init) => {
      signals.push(init.signal);
      return new Response(null, { status: 200 });
    },
  });
  await coreFetch("http://core.test");
  const caller = new AbortController();
  await coreFetch("http://core.test", { signal: caller.signal });
  assert.ok(signals[0] instanceof AbortSignal);
  assert.equal(signals[1], caller.signal);
});

test("createCoreFetch rejects invalid timeouts", () => {
  assert.throws(() => createCoreFetch({ timeoutMs: 0 }), /greater than zero/);
  assert.throws(() => createCoreFetch({ timeoutMs: Number.NaN }), /greater than zero/);
});

test("createCoreFetch aborts a request when its default timeout expires", async () => {
  const coreFetch = createCoreFetch({
    timeoutMs: 1,
    fetchImplementation: async (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    }),
  });
  await assert.rejects(coreFetch("http://core.test"), { name: "AbortError" });
});

test("runRuntimeLifecycle orders hooks and aborts pending work on failure", async () => {
  const runtime = new RuntimeContext();
  const order = [];
  let aborted = false;
  await assert.rejects(runRuntimeLifecycle(runtime, {
    env: { PIPHI_CONTAINER_ID: "c", PIPHI_INTEGRATION_INTERNAL_TOKEN: "t" },
    coreFetch: async () => new Response(null, { status: 200 }),
    backgroundTaskGracePeriodMs: 0,
    onStartup: async () => { order.push("startup"); },
    run: async () => {
      order.push("run");
      createTrackedTask(runtime.processState, (signal) => new Promise((resolve) => {
        signal.addEventListener("abort", () => { aborted = true; resolve(); }, { once: true });
      }));
      throw new Error("service stopped");
    },
    onShutdown: async () => { order.push("shutdown"); },
  }), /service stopped/);
  assert.deepEqual(order, ["startup", "run", "shutdown"]);
  assert.equal(aborted, true);
  assert.equal(runtime.processState.coreFetch, null);
});

test("runRuntimeLifecycle returns successful work without optional hooks", async () => {
  const runtime = new RuntimeContext();
  const result = await runRuntimeLifecycle(runtime, {
    env: {},
    coreFetch: async () => new Response(null, { status: 200 }),
    run: async (activeRuntime) => {
      assert.equal(activeRuntime.processState.coreFetch instanceof Function, true);
      return 42;
    },
  });
  assert.equal(result, 42);
  assert.equal(runtime.processState.coreFetch, null);
});
