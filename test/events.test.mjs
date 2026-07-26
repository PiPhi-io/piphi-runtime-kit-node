import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeAuthContext } from "../dist/runtime/auth.js";
import {
  CoreServerError,
  CoreTimeoutError,
  CoreUnavailableError,
} from "../dist/runtime/errors.js";
import {
  EventClient,
  buildCoreEventPayload,
  buildEventIngestResponse,
  buildEventListResponse,
  formatEventLog,
  normalizeEventPayload,
} from "../dist/runtime/events.js";
import { RuntimeProcessState } from "../dist/runtime/state.js";

test("normalizeEventPayload fills in an empty payload object", () => {
  assert.deepEqual(
    normalizeEventPayload({ eventType: "device.updated" }),
    { eventType: "device.updated", payload: {} },
  );
});

test("normalizeEventPayload preserves an existing payload", () => {
  assert.deepEqual(
    normalizeEventPayload({
      eventType: "device.updated",
      payload: { state: "on" },
    }),
    {
      eventType: "device.updated",
      payload: { state: "on" },
    },
  );
});

test("buildCoreEventPayload creates the canonical idempotent envelope", () => {
  const payload = {
    eventType: "device.configured",
    configId: "cfg-1",
    containerId: "container-1",
    integrationId: "integration-1",
  };
  const built = buildCoreEventPayload(payload);
  assert.equal(built.type, "device.configured");
  assert.equal(built.configId, "cfg-1");
  assert.match(built.eventId, /^[0-9a-f-]+$/i);
  assert.match(built.ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(built.data, {});
});

test("buildEventIngestResponse wraps an event in an ok payload", () => {
  assert.deepEqual(buildEventIngestResponse({ id: "event-1" }), {
    ok: true,
    event: { id: "event-1" },
  });
});

test("buildEventListResponse wraps an event list", () => {
  assert.deepEqual(buildEventListResponse([{ id: "event-2" }]), {
    events: [{ id: "event-2" }],
  });
});

test("formatEventLog includes ids when present", () => {
  assert.equal(
    formatEventLog({
      eventType: "device.updated",
      deviceId: "device-1",
      configId: "cfg-1",
    }),
    "event_ingest event_type=device.updated device_id=device-1 config_id=cfg-1",
  );
});

test("formatEventLog uses missing placeholders", () => {
  assert.equal(
    formatEventLog({ eventType: "device.updated" }),
    "event_ingest event_type=device.updated device_id=<missing> config_id=<missing>",
  );
});

test("EventClient normalizes trailing slashes and /api/v2 from coreBaseUrl", async () => {
  const state = new RuntimeProcessState();
  let capturedUrl = "";
  state.setCoreFetch(async (url) => {
    capturedUrl = String(url);
    return new Response(null, { status: 200 });
  });
  const client = new EventClient({
    processState: state,
    coreBaseUrl: "http://core.example/api/v2/",
  });
  await client.sendEvent({
    authContext: new RuntimeAuthContext(),
    event: buildCoreEventPayload({
      eventType: "device.updated",
      configId: "cfg-2",
      containerId: "container-2",
      integrationId: "integration-2",
    }),
  });
  assert.equal(capturedUrl, "http://core.example/api/v2/events/ingest");
});

test("EventClient sends the event body and auth headers", async () => {
  const state = new RuntimeProcessState();
  let requestInit;
  state.setCoreFetch(async (_url, init) => {
    requestInit = init;
    return new Response(null, { status: 200 });
  });
  const auth = new RuntimeAuthContext();
  auth.update({ containerId: "container-3", internalToken: "token-3" });
  const client = new EventClient({ processState: state });
  await client.sendEvent({
    authContext: auth,
    event: buildCoreEventPayload({
      eventType: "device.updated",
      configId: "cfg-3",
      containerId: "container-3",
      integrationId: "integration-3",
      payload: { state: "ok" },
    }),
  });
  assert.equal(requestInit.method, "POST");
  const body = JSON.parse(requestInit.body);
  assert.equal(body.type, "device.updated");
  assert.equal(body.config_id, "cfg-3");
  assert.equal(body.container_id, "container-3");
  assert.equal(body.integration_id, "integration-3");
  assert.deepEqual(body.data, { state: "ok" });
  assert.match(body.event_id, /^[0-9a-f-]+$/i);
  assert.match(body.ts, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(requestInit.headers, {
    "content-type": "application/json",
    "x-container-id": "container-3",
    "x-piphi-integration-token": "token-3",
  });
});

test("EventClient maps 5xx responses to CoreServerError", async () => {
  const state = new RuntimeProcessState();
  state.setCoreFetch(async () => new Response(null, { status: 500 }));
  const client = new EventClient({ processState: state });
  await assert.rejects(
    client.sendEvent({
      authContext: new RuntimeAuthContext(),
      event: buildCoreEventPayload({
        eventType: "device.updated",
        configId: "cfg-4",
        containerId: "container-4",
        integrationId: "integration-4",
      }),
    }),
    CoreServerError,
  );
});

test("EventClient maps AbortError to CoreTimeoutError", async () => {
  const state = new RuntimeProcessState();
  state.setCoreFetch(async () => {
    throw new DOMException("aborted", "AbortError");
  });
  const client = new EventClient({ processState: state });
  await assert.rejects(
    client.sendEvent({
      authContext: new RuntimeAuthContext(),
      event: buildCoreEventPayload({
        eventType: "device.updated",
        configId: "cfg-5",
        containerId: "container-5",
        integrationId: "integration-5",
      }),
    }),
    CoreTimeoutError,
  );
});

test("EventClient maps transport failures to CoreUnavailableError", async () => {
  const state = new RuntimeProcessState();
  state.setCoreFetch(async () => {
    throw new Error("connection reset");
  });
  const client = new EventClient({ processState: state });
  await assert.rejects(
    client.sendEvent({
      authContext: new RuntimeAuthContext(),
      event: buildCoreEventPayload({
        eventType: "device.updated",
        configId: "cfg-6",
        containerId: "container-6",
        integrationId: "integration-6",
      }),
    }),
    CoreUnavailableError,
  );
});

test("EventClient rethrows already-classified errors unchanged", async () => {
  const state = new RuntimeProcessState();
  const classified = new CoreUnavailableError({
    operation: "event_delivery",
    url: "http://core.test/events",
    message: "PiPhi Core is unreachable",
    retryable: true,
  });
  state.setCoreFetch(async () => {
    throw classified;
  });
  const client = new EventClient({ processState: state });
  await assert.rejects(
    client.sendEvent({
      authContext: new RuntimeAuthContext(),
      event: buildCoreEventPayload({
        eventType: "device.updated",
        configId: "cfg-7",
        containerId: "container-7",
        integrationId: "integration-7",
      }),
    }),
    (error) => error === classified,
  );
});
