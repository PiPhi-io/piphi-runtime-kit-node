import assert from "node:assert/strict";
import test from "node:test";

import {
  awaitPendingBackgroundTasks,
  createTrackedTask,
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
