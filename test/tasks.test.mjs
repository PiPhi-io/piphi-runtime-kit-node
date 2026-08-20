import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitPendingBackgroundTasks,
  BackgroundTaskLimitError,
  createTrackedTask,
  shutdownBackgroundTasks,
  trackBackgroundTask,
} from "../dist/runtime/tasks.js";
import { RuntimeProcessState } from "../dist/runtime/state.js";
import { createDeferred, flushMicrotasks } from "./helpers.mjs";

test("trackBackgroundTask adds a pending task", () => {
  const state = new RuntimeProcessState();
  const deferred = createDeferred();
  trackBackgroundTask(state, deferred.promise);
  assert.equal(state.backgroundTasks.size, 1);
  deferred.resolve();
});

test("trackBackgroundTask removes a resolved task after settlement", async () => {
  const state = new RuntimeProcessState();
  const deferred = createDeferred();
  const tracked = trackBackgroundTask(state, deferred.promise);
  deferred.resolve("done");
  await tracked;
  await flushMicrotasks();
  assert.equal(state.backgroundTasks.size, 0);
});

test("trackBackgroundTask removes a rejected task after settlement", async () => {
  const state = new RuntimeProcessState();
  const deferred = createDeferred();
  const tracked = trackBackgroundTask(state, deferred.promise);
  deferred.reject(new Error("failed"));
  await assert.rejects(tracked, /failed/);
  await flushMicrotasks();
  assert.equal(state.backgroundTasks.size, 0);
});

test("createTrackedTask is an alias for trackBackgroundTask behavior", async () => {
  const state = new RuntimeProcessState();
  const tracked = createTrackedTask(state, Promise.resolve("value"));
  assert.equal(await tracked, "value");
  await flushMicrotasks();
  assert.equal(state.backgroundTasks.size, 0);
});

test("awaitPendingBackgroundTasks waits for current pending tasks", async () => {
  const state = new RuntimeProcessState();
  const deferred = createDeferred();
  trackBackgroundTask(state, deferred.promise);
  const waiter = awaitPendingBackgroundTasks(state);
  deferred.resolve("done");
  await waiter;
  assert.equal(state.backgroundTasks.size, 0);
});

test("awaitPendingBackgroundTasks settles even when tasks reject", async () => {
  const state = new RuntimeProcessState();
  const deferred = createDeferred();
  const tracked = trackBackgroundTask(state, deferred.promise);
  const waiter = awaitPendingBackgroundTasks(state);
  deferred.reject(new Error("boom"));
  await waiter;
  await assert.rejects(tracked, /boom/);
});

test("RuntimeProcessState rejects invalid task limits", () => {
  assert.throws(() => new RuntimeProcessState({ maxBackgroundTasks: 0 }), /positive integer/);
});

test("background task limits provide backpressure and diagnostics", () => {
  const state = new RuntimeProcessState({ maxBackgroundTasks: 1 });
  const deferred = createDeferred();
  trackBackgroundTask(state, deferred.promise);
  assert.throws(
    () => createTrackedTask(state, Promise.resolve()),
    BackgroundTaskLimitError,
  );
  assert.equal(state.backgroundTaskRejectedCount, 1);
  deferred.resolve();
});

test("failed background tasks increment the failure counter", async () => {
  const state = new RuntimeProcessState();
  const tracked = trackBackgroundTask(state, Promise.reject(new Error("broken")));
  await assert.rejects(tracked, /broken/);
  await flushMicrotasks();
  assert.equal(state.backgroundTaskFailureCount, 1);
});

test("shutdownBackgroundTasks aborts factory-created tasks after the grace period", async () => {
  const state = new RuntimeProcessState();
  let observedAbort = false;
  const tracked = createTrackedTask(state, (signal) => new Promise((resolve) => {
    signal.addEventListener("abort", () => {
      observedAbort = true;
      resolve("stopped");
    }, { once: true });
  }));
  await Promise.resolve();
  await shutdownBackgroundTasks(state, { gracePeriodMs: 0 });
  assert.equal(await tracked, "stopped");
  assert.equal(observedAbort, true);
  assert.equal(state.backgroundTasks.size, 0);
});

test("immediate shutdown rejects not-yet-started factories without hanging", async () => {
  const state = new RuntimeProcessState();
  const tracked = createTrackedTask(state, async () => "too late");
  await shutdownBackgroundTasks(state, { gracePeriodMs: 0 });
  await assert.rejects(tracked, { name: "AbortError" });
  assert.equal(state.backgroundTaskFailureCount, 0);
  assert.equal(state.backgroundTasks.size, 0);
});

test("shutdownBackgroundTasks validates the grace period", async () => {
  await assert.rejects(
    shutdownBackgroundTasks(new RuntimeProcessState(), { gracePeriodMs: -1 }),
    /cannot be negative/,
  );
});
