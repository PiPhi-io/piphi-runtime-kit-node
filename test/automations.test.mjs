import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  AutomationActionResult,
  AutomationRegistry,
  FileAutomationIdempotencyStore,
  InMemoryAutomationIdempotencyStore,
  assertBehaviorsContract,
  auditBehaviorsContract,
  buildMockAutomationEvent,
  dispatchAutomationActionFromExpress,
  dispatchAutomationActionFromFastify,
} from "../dist/index.js";

test("registry normalizes requests and dispatches registered actions", async () => {
  const registry = new AutomationRegistry();
  registry.action("light.set", { label: "Set light" })(async (request) => ({
    deviceId: request.deviceId,
    brightness: request.args.brightness,
  }));

  const result = await registry.dispatch({
    command: " light.set ",
    args: { brightness: 40 },
    device_id: "lamp-1",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.result, { deviceId: "lamp-1", brightness: 40 });
});

test("concurrent duplicate commands execute exactly once in one process", async () => {
  const registry = new AutomationRegistry({
    idempotencyStore: new InMemoryAutomationIdempotencyStore(),
  });
  let calls = 0;
  registry.action("door.unlock")(async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { unlocked: true };
  });

  const request = { command: "door.unlock", args: {}, idempotency_key: "run-1:node-2" };
  const [first, second] = await Promise.all([registry.dispatch(request), registry.dispatch(request)]);

  assert.equal(calls, 1);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal([first.replayed, second.replayed].filter(Boolean).length, 1);
});

test("retryable failures release a durable claim and can be attempted again", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "piphi-node-automation-"));
  try {
    const registry = new AutomationRegistry({
      idempotencyStore: new FileAutomationIdempotencyStore(directory),
    });
    let calls = 0;
    registry.action("speaker.play")(() => {
      calls += 1;
      return calls === 1
        ? AutomationActionResult.failure("temporarily unavailable", { retryable: true })
        : { playing: true };
    });

    const request = { command: "speaker.play", args: {}, idempotencyKey: "effect-1" };
    assert.equal((await registry.dispatch(request)).retryable, true);
    assert.equal((await registry.dispatch(request)).ok, true);
    assert.equal(calls, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("durable results replay after a process restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "piphi-node-automation-"));
  try {
    const first = new AutomationRegistry({ idempotencyStore: new FileAutomationIdempotencyStore(directory) });
    first.action("scene.activate")(() => ({ activated: true }));
    await first.dispatch({ command: "scene.activate", args: {}, idempotencyKey: "effect-2" });

    let replayHandlerCalls = 0;
    const restarted = new AutomationRegistry({ idempotencyStore: new FileAutomationIdempotencyStore(directory) });
    restarted.action("scene.activate")(() => {
      replayHandlerCalls += 1;
      return { activated: true };
    });
    const replay = await restarted.dispatch({ command: "scene.activate", args: {}, idempotencyKey: "effect-2" });

    assert.equal(replay.ok, true);
    assert.equal(replay.replayed, true);
    assert.equal(replayHandlerCalls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("an abandoned durable claim is ambiguous and never repeats the effect", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "piphi-node-automation-"));
  try {
    const store = new FileAutomationIdempotencyStore(directory);
    await store.claim("lock.open:effect-3");
    let calls = 0;
    const registry = new AutomationRegistry({ idempotencyStore: store });
    registry.action("lock.open")(() => {
      calls += 1;
      return { open: true };
    });

    const result = await registry.dispatch({ command: "lock.open", args: {}, idempotencyKey: "effect-3" });
    assert.equal(result.ok, false);
    assert.equal(result.retryable, false);
    assert.equal(result.metadata.deliveryStatus, "ambiguous");
    assert.equal(result.replayed, true);
    assert.equal(calls, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("framework adapters prefer Core's idempotency header", async () => {
  for (const framework of ["fastify", "express"]) {
    const registry = new AutomationRegistry({ idempotencyStore: new InMemoryAutomationIdempotencyStore() });
    let calls = 0;
    registry.action("fan.set")(() => ({ calls: ++calls }));
    const body = { command: "fan.set", args: {}, idempotencyKey: "body-key" };
    const result = framework === "fastify"
      ? await dispatchAutomationActionFromFastify(registry, {
          headers: { "x-piphi-idempotency-key": "header-key" }, body,
        })
      : await dispatchAutomationActionFromExpress(registry, {
          headers: { "x-piphi-idempotency-key": "header-key" }, body,
          header: (name) => name === "x-piphi-idempotency-key" ? "header-key" : undefined,
        });
    assert.equal(result.ok, true);
    const replay = await registry.dispatch({ ...body, idempotencyKey: "header-key" });
    assert.equal(replay.replayed, true);
    assert.equal(calls, 1);
  }
});

test("behaviors contract audit reports drift in both directions", () => {
  const registry = new AutomationRegistry();
  registry.action("light.set")(() => ({}));
  registry.action("undeclared.action")(() => ({}));
  registry.event("sensor.changed");
  const behaviors = {
    devices: [{
      actions: [
        { runtime: { command: "light.set" } },
        { runtime: { command: "missing.action" } },
      ],
      triggers: [
        { runtime: { event: "sensor.changed" } },
        { runtime: { events: ["missing.event"] } },
      ],
    }],
  };

  const report = auditBehaviorsContract(behaviors, registry);
  assert.equal(report.ok, false);
  assert.deepEqual(report.missingActionHandlers, ["missing.action"]);
  assert.deepEqual(report.missingEventPublishers, ["missing.event"]);
  assert.deepEqual(report.undeclaredActionHandlers, ["undeclared.action"]);
  assert.throws(() => assertBehaviorsContract(behaviors, registry), /Missing action handlers/);
});

test("mock events use realistic Core envelopes without creating a UI run mode", () => {
  const event = buildMockAutomationEvent({
    eventType: "air.quality.changed",
    data: { score: 72 },
    eventId: "mock-event-1",
  });
  assert.equal(event.type, "air.quality.changed");
  assert.equal(event.eventId, "mock-event-1");
  assert.deepEqual(event.data, { score: 72, source: "automation-sdk-mock" });
});
