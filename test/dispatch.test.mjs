import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalEventRecord,
  dispatchEventDelivery,
  dispatchTelemetryDelivery,
  scheduleEventDelivery,
  scheduleTelemetryDelivery,
} from "../dist/runtime/dispatch.js";
import { RuntimeAuthContext } from "../dist/runtime/auth.js";
import { EventClient } from "../dist/runtime/events.js";
import { RuntimeProcessState } from "../dist/runtime/state.js";
import { TelemetryClient } from "../dist/runtime/telemetry.js";
import { createDeferred, flushMicrotasks } from "./helpers.mjs";

test("buildLocalEventRecord adds receivedAt without dropping event fields", () => {
  const record = buildLocalEventRecord({
    eventType: "device.updated",
    payload: { battery: 90 },
  });
  assert.equal(record.eventType, "device.updated");
  assert.deepEqual(record.payload, { battery: 90 });
  assert.match(record.receivedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("scheduleTelemetryDelivery passes required fields to the telemetry client", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const telemetryClient = {
    sendMetrics: async (options) => {
      received = options;
    },
  };
  await scheduleTelemetryDelivery({
    processState,
    telemetryClient,
    authContext: new RuntimeAuthContext(),
    deviceId: "device-1",
    metrics: { humidity: 44 },
  });
  assert.equal(received.deviceId, "device-1");
  assert.deepEqual(received.metrics, { humidity: 44 });
});

test("scheduleTelemetryDelivery forwards optional units and containerId", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const telemetryClient = {
    sendMetrics: async (options) => {
      received = options;
    },
  };
  await scheduleTelemetryDelivery({
    processState,
    telemetryClient,
    authContext: new RuntimeAuthContext(),
    deviceId: "device-2",
    metrics: { temperature: 21.2 },
    units: { temperature: "C" },
    containerId: "container-2",
  });
  assert.deepEqual(received.units, { temperature: "C" });
  assert.equal(received.containerId, "container-2");
});

test("scheduleTelemetryDelivery tracks background tasks until completion", async () => {
  const processState = new RuntimeProcessState();
  const deferred = createDeferred();
  const telemetryClient = {
    sendMetrics: async () => deferred.promise,
  };
  const task = scheduleTelemetryDelivery({
    processState,
    telemetryClient,
    authContext: new RuntimeAuthContext(),
    deviceId: "device-3",
    metrics: { value: 3 },
  });
  assert.equal(processState.backgroundTasks.size, 1);
  deferred.resolve();
  await task;
  await flushMicrotasks();
  assert.equal(processState.backgroundTasks.size, 0);
});

test("scheduleEventDelivery uses configId when present", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: new RuntimeAuthContext(),
    eventType: "device.updated",
    device: {
      configId: "cfg-10",
      deviceId: "device-10",
      containerId: "container-10",
      integrationId: "integration-10",
    },
  });
  assert.equal(received.event.configId, "cfg-10");
});

test("scheduleEventDelivery leaves configId empty when config scope is missing", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: new RuntimeAuthContext(),
    eventType: "device.updated",
    device: {
      deviceId: "device-11",
      containerId: "container-11",
      integrationId: "integration-11",
    },
  });
  assert.equal(received.event.configId, "");
});

test("scheduleEventDelivery uses an empty configId when neither id is present", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: new RuntimeAuthContext(),
    eventType: "device.updated",
    device: {},
  });
  assert.equal(received.event.configId, "");
});

test("scheduleEventDelivery uses device containerId before auth fallback", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "auth-container" });
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: auth,
    eventType: "device.updated",
    device: { containerId: "device-container" },
  });
  assert.equal(received.event.containerId, "device-container");
});

test("scheduleEventDelivery falls back containerId to auth context", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "auth-container-2" });
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: auth,
    eventType: "device.updated",
    device: {},
  });
  assert.equal(received.event.containerId, "auth-container-2");
});

test("scheduleEventDelivery stringifies integrationId and deviceId", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: new RuntimeAuthContext(),
    eventType: "device.updated",
    device: { integrationId: 123, deviceId: 456, containerId: "container-12" },
  });
  assert.equal(received.event.integrationId, "123");
  assert.equal(received.event.deviceId, "456");
});

test("scheduleEventDelivery omits deviceId when falsey", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: new RuntimeAuthContext(),
    eventType: "device.updated",
    device: { deviceId: "", containerId: "container-13" },
  });
  assert.equal("deviceId" in received.event, false);
});

test("scheduleEventDelivery forwards source and payload", async () => {
  const processState = new RuntimeProcessState();
  let received;
  const eventClient = {
    sendEvent: async (options) => {
      received = options;
    },
  };
  await scheduleEventDelivery({
    processState,
    eventClient,
    authContext: new RuntimeAuthContext(),
    eventType: "device.updated",
    source: "poller",
    payload: { battery: 82 },
    device: { configId: "cfg-14", containerId: "container-14" },
  });
  assert.equal(received.event.source, "poller");
  assert.deepEqual(received.event.payload, { battery: 82 });
});

test("dispatch aliases match the schedule helpers", () => {
  assert.equal(dispatchTelemetryDelivery, scheduleTelemetryDelivery);
  assert.equal(dispatchEventDelivery, scheduleEventDelivery);
});
