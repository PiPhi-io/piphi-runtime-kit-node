import assert from "node:assert/strict";
import test from "node:test";

import {
  formatExpressRuntimeAuthSyncLog,
  getPayloadContainerIdFromExpressBody,
  readExpressHeaderValue,
  syncRuntimeAuthFromExpressRequest,
} from "../dist/adapters/express.js";
import {
  formatFastifyRuntimeAuthSyncLog,
  getPayloadContainerIdFromFastifyBody,
  readFastifyHeaderValue,
  syncRuntimeAuthFromFastifyRequest,
} from "../dist/adapters/fastify.js";
import { RuntimeContext } from "../dist/runtime/context.js";

test("readExpressHeaderValue returns string values unchanged", () => {
  assert.equal(readExpressHeaderValue("value"), "value");
});

test("readExpressHeaderValue returns the first value from arrays", () => {
  assert.equal(readExpressHeaderValue(["first", "second"]), "first");
});

test("readExpressHeaderValue returns undefined for missing values", () => {
  assert.equal(readExpressHeaderValue(undefined), undefined);
});

test("getPayloadContainerIdFromExpressBody reads camelCase containerId", () => {
  assert.equal(
    getPayloadContainerIdFromExpressBody({ containerId: "container-1" }),
    "container-1",
  );
});

test("getPayloadContainerIdFromExpressBody reads snake_case container_id", () => {
  assert.equal(
    getPayloadContainerIdFromExpressBody({ container_id: "container-2" }),
    "container-2",
  );
});

test("getPayloadContainerIdFromExpressBody returns null for invalid bodies", () => {
  assert.equal(getPayloadContainerIdFromExpressBody(null), null);
  assert.equal(getPayloadContainerIdFromExpressBody("bad"), null);
});

test("syncRuntimeAuthFromExpressRequest reads headers and payload container id", () => {
  const runtime = new RuntimeContext();
  const req = {
    body: { container_id: "payload-container" },
    header(name) {
      return {
        "x-container-id": "header-container",
        "x-piphi-integration-token": "token-1",
      }[name];
    },
  };
  const result = syncRuntimeAuthFromExpressRequest(runtime, req);
  assert.deepEqual(result, {
    containerId: "payload-container",
    internalToken: "token-1",
  });
});

test("syncRuntimeAuthFromExpressRequest accepts an explicit payload override", () => {
  const runtime = new RuntimeContext();
  const req = {
    body: { containerId: "body-container" },
    header(name) {
      return {
        "x-container-id": "header-container",
        "x-piphi-integration-token": "token-2",
      }[name];
    },
  };
  const result = syncRuntimeAuthFromExpressRequest(runtime, req, "explicit-container");
  assert.equal(result.containerId, "explicit-container");
});

test("formatExpressRuntimeAuthSyncLog formats a safe log line", () => {
  const req = {
    body: { containerId: "payload-container-3" },
    header(name) {
      return {
        "x-container-id": "header-container-3",
        "x-piphi-integration-token": "test-token-3",
      }[name];
    },
  };
  const line = formatExpressRuntimeAuthSyncLog(req);
  assert.match(line, /header_container_id=header-container-3/);
  assert.match(line, /payload_container_id=payload-container-3/);
  assert.match(line, /internal_token=tes\*\*\*-3/);
});

test("readFastifyHeaderValue returns string values unchanged", () => {
  assert.equal(readFastifyHeaderValue("value"), "value");
});

test("readFastifyHeaderValue returns the first value from arrays", () => {
  assert.equal(readFastifyHeaderValue(["first", "second"]), "first");
});

test("readFastifyHeaderValue returns undefined for missing values", () => {
  assert.equal(readFastifyHeaderValue(undefined), undefined);
});

test("getPayloadContainerIdFromFastifyBody reads camelCase containerId", () => {
  assert.equal(
    getPayloadContainerIdFromFastifyBody({ containerId: "container-4" }),
    "container-4",
  );
});

test("getPayloadContainerIdFromFastifyBody reads snake_case container_id", () => {
  assert.equal(
    getPayloadContainerIdFromFastifyBody({ container_id: "container-5" }),
    "container-5",
  );
});

test("getPayloadContainerIdFromFastifyBody returns null for invalid bodies", () => {
  assert.equal(getPayloadContainerIdFromFastifyBody(undefined), null);
  assert.equal(getPayloadContainerIdFromFastifyBody("bad"), null);
});

test("syncRuntimeAuthFromFastifyRequest reads headers and payload container id", () => {
  const runtime = new RuntimeContext();
  const req = {
    headers: {
      "x-container-id": "header-container-6",
      "x-piphi-integration-token": "token-6",
    },
    body: { containerId: "payload-container-6" },
  };
  const result = syncRuntimeAuthFromFastifyRequest(runtime, req);
  assert.deepEqual(result, {
    containerId: "payload-container-6",
    internalToken: "token-6",
  });
});

test("syncRuntimeAuthFromFastifyRequest accepts an explicit payload override", () => {
  const runtime = new RuntimeContext();
  const req = {
    headers: {
      "x-container-id": "header-container-7",
      "x-piphi-integration-token": "token-7",
    },
    body: { container_id: "payload-container-7" },
  };
  const result = syncRuntimeAuthFromFastifyRequest(runtime, req, "explicit-container-7");
  assert.equal(result.containerId, "explicit-container-7");
});

test("formatFastifyRuntimeAuthSyncLog formats a safe log line", () => {
  const req = {
    headers: {
      "x-container-id": "header-container-8",
        "x-piphi-integration-token": "test-token-8",
    },
    body: { container_id: "payload-container-8" },
  };
  const line = formatFastifyRuntimeAuthSyncLog(req);
  assert.match(line, /header_container_id=header-container-8/);
  assert.match(line, /payload_container_id=payload-container-8/);
  assert.match(line, /internal_token=tes\*\*\*-8/);
});
