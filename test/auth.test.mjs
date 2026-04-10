import assert from "node:assert/strict";
import test from "node:test";

import {
  RUNTIME_CONTAINER_ID_HEADER_NAME,
  RUNTIME_INTERNAL_TOKEN_HEADER_NAME,
  RuntimeAuthContext,
  buildRuntimeAuthHeaders,
  extractRuntimeAuthHeaders,
  formatRuntimeAuthSyncLog,
  maskToken,
} from "../dist/runtime/auth.js";

test("runtime auth header constants match expected names", () => {
  assert.equal(RUNTIME_CONTAINER_ID_HEADER_NAME, "x-container-id");
  assert.equal(RUNTIME_INTERNAL_TOKEN_HEADER_NAME, "x-piphi-integration-token");
});

for (const [label, value, expected] of [
  ["undefined token", undefined, "<missing>"],
  ["null token", null, "<missing>"],
  ["empty token", "", "<missing>"],
  ["short token", "abc", "a***"],
  ["six-character token", "abcdef", "a***"],
  ["long token", "abcdefghij", "abc***ij"],
]) {
  test(`maskToken handles ${label}`, () => {
    assert.equal(maskToken(value), expected);
  });
}

test("extractRuntimeAuthHeaders reads from Headers", () => {
  const headers = new Headers({
    "x-container-id": "container-1",
    "x-piphi-integration-token": "token-1",
  });
  assert.deepEqual(extractRuntimeAuthHeaders(headers), {
    containerId: "container-1",
    internalToken: "token-1",
  });
});

test("extractRuntimeAuthHeaders reads direct record keys", () => {
  assert.deepEqual(
    extractRuntimeAuthHeaders({
      "x-container-id": "container-2",
      "x-piphi-integration-token": "token-2",
    }),
    {
      containerId: "container-2",
      internalToken: "token-2",
    },
  );
});

test("extractRuntimeAuthHeaders falls back to lowercase lookup", () => {
  assert.deepEqual(
    extractRuntimeAuthHeaders({
      [RUNTIME_CONTAINER_ID_HEADER_NAME.toUpperCase()]: undefined,
      [RUNTIME_CONTAINER_ID_HEADER_NAME]: "container-3",
      [RUNTIME_INTERNAL_TOKEN_HEADER_NAME]: "token-3",
    }),
    {
      containerId: "container-3",
      internalToken: "token-3",
    },
  );
});

test("extractRuntimeAuthHeaders returns nulls when values are absent", () => {
  assert.deepEqual(extractRuntimeAuthHeaders({}), {
    containerId: null,
    internalToken: null,
  });
});

for (const [label, input, expected] of [
  [
    "both headers",
    { containerId: "container-a", internalToken: "token-a" },
    {
      "x-container-id": "container-a",
      "x-piphi-integration-token": "token-a",
    },
  ],
  [
    "missing container id",
    { containerId: null, internalToken: "token-b" },
    {
      "x-piphi-integration-token": "token-b",
    },
  ],
  [
    "missing token",
    { containerId: "container-c", internalToken: undefined },
    {
      "x-container-id": "container-c",
    },
  ],
  ["all missing", {}, {}],
]) {
  test(`buildRuntimeAuthHeaders handles ${label}`, () => {
    assert.deepEqual(buildRuntimeAuthHeaders(input), expected);
  });
}

test("RuntimeAuthContext.update sets both values", () => {
  const context = new RuntimeAuthContext();
  context.update({ containerId: "container-4", internalToken: "token-4" });
  assert.equal(context.containerId, "container-4");
  assert.equal(context.internalToken, "token-4");
});

test("RuntimeAuthContext.update preserves values when fields are undefined", () => {
  const context = new RuntimeAuthContext();
  context.update({ containerId: "container-5", internalToken: "token-5" });
  context.update({});
  assert.equal(context.containerId, "container-5");
  assert.equal(context.internalToken, "token-5");
});

test("RuntimeAuthContext.update clears values when null is provided", () => {
  const context = new RuntimeAuthContext();
  context.update({ containerId: "container-6", internalToken: "token-6" });
  context.update({ containerId: null, internalToken: null });
  assert.equal(context.containerId, null);
  assert.equal(context.internalToken, null);
});

test("RuntimeAuthContext.syncFromHeaders prefers payload container id over header", () => {
  const context = new RuntimeAuthContext();
  const result = context.syncFromHeaders(
    {
      "x-container-id": "header-container",
      "x-piphi-integration-token": "header-token",
    },
    "payload-container",
  );
  assert.deepEqual(result, {
    containerId: "payload-container",
    internalToken: "header-token",
  });
});

test("RuntimeAuthContext.syncFromHeaders uses header container id when payload is undefined", () => {
  const context = new RuntimeAuthContext();
  const result = context.syncFromHeaders({
    "x-container-id": "header-container-2",
    "x-piphi-integration-token": "header-token-2",
  });
  assert.deepEqual(result, {
    containerId: "header-container-2",
    internalToken: "header-token-2",
  });
});

test("RuntimeAuthContext.syncFromHeaders preserves container when payload is null", () => {
  const context = new RuntimeAuthContext();
  context.update({ containerId: "existing-container", internalToken: "old-token" });
  const result = context.syncFromHeaders(
    { "x-piphi-integration-token": "new-token" },
    null,
  );
  assert.deepEqual(result, {
    containerId: null,
    internalToken: "new-token",
  });
});

test("RuntimeAuthContext.resolve prefers explicit values", () => {
  const context = new RuntimeAuthContext();
  context.update({ containerId: "context-container", internalToken: "context-token" });
  assert.deepEqual(
    context.resolve({
      containerId: "explicit-container",
      internalToken: "explicit-token",
    }),
    {
      containerId: "explicit-container",
      internalToken: "explicit-token",
    },
  );
});

test("RuntimeAuthContext.resolve falls back to stored values", () => {
  const context = new RuntimeAuthContext();
  context.update({ containerId: "context-container-2", internalToken: "context-token-2" });
  assert.deepEqual(context.resolve(), {
    containerId: "context-container-2",
    internalToken: "context-token-2",
  });
});

test("formatRuntimeAuthSyncLog masks the token", () => {
  const line = formatRuntimeAuthSyncLog(
    {
      containerId: "header-container-3",
      internalToken: "test-token-example",
    },
    "payload-container-3",
  );
  assert.match(line, /^runtime_auth_sync /);
  assert.match(line, /header_container_id=header-container-3/);
  assert.match(line, /payload_container_id=payload-container-3/);
  assert.match(line, /internal_token=tes\*\*\*le/);
});

test("formatRuntimeAuthSyncLog uses missing placeholders", () => {
  assert.equal(
    formatRuntimeAuthSyncLog({ containerId: null, internalToken: null }),
    "runtime_auth_sync header_container_id=<missing> payload_container_id=<missing> internal_token=<missing>",
  );
});
