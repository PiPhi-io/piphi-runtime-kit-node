import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_PORT_ENV_NAME, runtimePort } from "../dist/index.js";

test("runtimePort falls back when Core did not assign a port", () => {
  assert.equal(runtimePort(8090, {}), 8090);
});

test("runtimePort uses the Core-assigned port", () => {
  assert.equal(runtimePort(8090, { [RUNTIME_PORT_ENV_NAME]: "43127" }), 43127);
});

test("runtimePort rejects invalid Core assignments", () => {
  for (const value of ["", "nope", "0", "65536"]) {
    assert.throws(() => runtimePort(8090, { PORT: value }), /PORT/);
  }
});
