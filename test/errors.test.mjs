import assert from "node:assert/strict";
import test from "node:test";

import {
  CoreAuthError,
  CoreDeliveryError,
  CoreRouteNotFoundError,
  CoreServerError,
  CoreTimeoutError,
  CoreUnavailableError,
  CoreUnexpectedResponseError,
  classifyCoreDeliveryError,
} from "../dist/runtime/errors.js";

test("CoreDeliveryError.toString includes optional fields", () => {
  const error = new CoreDeliveryError({
    operation: "telemetry_delivery",
    url: "http://core.test/api/v2/integrations/telemetry",
    message: "boom",
    retryable: true,
    statusCode: 500,
    timeoutMs: 3000,
  });
  assert.equal(
    error.toString(),
    "boom operation=telemetry_delivery url=http://core.test/api/v2/integrations/telemetry statusCode=500 timeoutMs=3000 retryable=true",
  );
});

test("CoreDeliveryError.toString omits undefined optional fields", () => {
  const error = new CoreDeliveryError({
    operation: "event_delivery",
    url: "http://core.test/api/v2/events/ingest",
    message: "boom-2",
    retryable: false,
  });
  assert.equal(
    error.toString(),
    "boom-2 operation=event_delivery url=http://core.test/api/v2/events/ingest retryable=false",
  );
});

for (const [status, ErrorType, retryable] of [
  [404, CoreRouteNotFoundError, false],
  [401, CoreAuthError, false],
  [403, CoreAuthError, false],
  [500, CoreServerError, true],
  [503, CoreServerError, true],
  [400, CoreUnexpectedResponseError, false],
  [429, CoreUnexpectedResponseError, false],
]) {
  test(`classifyCoreDeliveryError maps HTTP ${status} correctly`, () => {
    const error = classifyCoreDeliveryError({
      error: null,
      operation: "telemetry_delivery",
      url: "http://core.test/request",
      timeoutMs: 4500,
      response: new Response(null, { status }),
    });
    assert.ok(error instanceof ErrorType);
    assert.equal(error.statusCode, status);
    assert.equal(error.retryable, retryable);
    assert.equal(error.timeoutMs, 4500);
  });
}

test("classifyCoreDeliveryError maps AbortError to CoreTimeoutError", () => {
  const error = classifyCoreDeliveryError({
    error: new DOMException("aborted", "AbortError"),
    operation: "event_delivery",
    url: "http://core.test/events",
    timeoutMs: 3200,
  });
  assert.ok(error instanceof CoreTimeoutError);
  assert.equal(error.retryable, true);
  assert.equal(error.timeoutMs, 3200);
});

for (const sample of [
  new Error("network failed"),
  "network failed",
  { message: "network failed" },
]) {
  test(`classifyCoreDeliveryError maps non-response failures to CoreUnavailableError for ${typeof sample}`, () => {
    const error = classifyCoreDeliveryError({
      error: sample,
      operation: "telemetry_delivery",
      url: "http://core.test/telemetry",
    });
    assert.ok(error instanceof CoreUnavailableError);
    assert.equal(error.retryable, true);
  });
}

test("route-not-found errors use a meaningful message", () => {
  const error = classifyCoreDeliveryError({
    error: null,
    operation: "event_delivery",
    url: "http://core.test/events",
    response: new Response(null, { status: 404 }),
  });
  assert.equal(error.message, "PiPhi Core route is not available");
});

test("auth errors use a meaningful message", () => {
  const error = classifyCoreDeliveryError({
    error: null,
    operation: "event_delivery",
    url: "http://core.test/events",
    response: new Response(null, { status: 401 }),
  });
  assert.equal(error.message, "PiPhi Core rejected the runtime authentication headers");
});

test("server errors use a meaningful message", () => {
  const error = classifyCoreDeliveryError({
    error: null,
    operation: "telemetry_delivery",
    url: "http://core.test/telemetry",
    response: new Response(null, { status: 500 }),
  });
  assert.equal(error.message, "PiPhi Core failed while processing the delivery request");
});

test("unexpected response errors use a meaningful message", () => {
  const error = classifyCoreDeliveryError({
    error: null,
    operation: "telemetry_delivery",
    url: "http://core.test/telemetry",
    response: new Response(null, { status: 422 }),
  });
  assert.equal(error.message, "PiPhi Core returned an unexpected non-success response");
});

test("timeout errors use a meaningful message", () => {
  const error = classifyCoreDeliveryError({
    error: new DOMException("aborted", "AbortError"),
    operation: "telemetry_delivery",
    url: "http://core.test/telemetry",
  });
  assert.equal(error.message, "PiPhi Core did not respond before the request timeout");
});

test("unavailable errors use a meaningful message", () => {
  const error = classifyCoreDeliveryError({
    error: new Error("socket closed"),
    operation: "telemetry_delivery",
    url: "http://core.test/telemetry",
  });
  assert.equal(error.message, "PiPhi Core is unreachable");
});
