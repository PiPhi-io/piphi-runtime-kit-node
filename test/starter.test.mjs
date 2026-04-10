import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeStarter, createRuntimeStarter } from "../dist/runtime/starter.js";

test("RuntimeStarter stores integration metadata", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-1",
    integrationName: "Integration One",
  });
  assert.equal(starter.integrationId, "integration-1");
  assert.equal(starter.integrationName, "Integration One");
  assert.equal(starter.version, "0.1.0");
});

test("RuntimeStarter respects a custom version", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-2",
    integrationName: "Integration Two",
    version: "2.3.4",
  });
  assert.equal(starter.version, "2.3.4");
});

test("RuntimeStarter applies a custom coreBaseUrl to process state", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-3",
    integrationName: "Integration Three",
    coreBaseUrl: "http://core.example",
  });
  assert.equal(starter.runtime.processState.coreBaseUrl, "http://core.example");
});

test("RuntimeStarter uses a custom maxRecentEvents for the registry", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-4",
    integrationName: "Integration Four",
    maxRecentEvents: 12,
  });
  assert.equal(starter.registry.maxRecentEvents, 12);
});

test("RuntimeStarter.integrationMetadata returns the metadata payload", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-5",
    integrationName: "Integration Five",
    version: "5.0.0",
  });
  assert.deepEqual(starter.integrationMetadata(), {
    id: "integration-5",
    name: "Integration Five",
    version: "5.0.0",
  });
});

test("RuntimeStarter.healthResponse includes default metadata", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-6",
    integrationName: "Integration Six",
  });
  starter.registry.set("cfg-1", {});
  starter.registry.set("cfg-2", {});
  const response = starter.healthResponse();
  assert.deepEqual(response.metadata, { activeConfigs: 2 });
});

test("RuntimeStarter.healthResponse accepts custom metadata", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-7",
    integrationName: "Integration Seven",
  });
  const response = starter.healthResponse({ mode: "test" });
  assert.deepEqual(response.metadata, { mode: "test" });
});

test("RuntimeStarter.diagnosticsResponse includes default diagnostics", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-8",
    integrationName: "Integration Eight",
  });
  starter.registry.set("cfg-8", {});
  starter.registry.appendEvent({ eventType: "device.updated" });
  const response = starter.diagnosticsResponse();
  assert.deepEqual(response.diagnostics, {
    activeConfigIds: ["cfg-8"],
    recentEventCount: 1,
  });
});

test("RuntimeStarter.diagnosticsResponse accepts custom diagnostics", () => {
  const starter = new RuntimeStarter({
    integrationId: "integration-9",
    integrationName: "Integration Nine",
  });
  const response = starter.diagnosticsResponse({ health: "green" });
  assert.deepEqual(response.diagnostics, { health: "green" });
});

test("createRuntimeStarter returns a RuntimeStarter instance", () => {
  const starter = createRuntimeStarter({
    integrationId: "integration-10",
    integrationName: "Integration Ten",
  });
  assert.ok(starter instanceof RuntimeStarter);
  assert.ok(starter.telemetryClient);
  assert.ok(starter.eventClient);
  assert.ok(starter.configSync);
});
