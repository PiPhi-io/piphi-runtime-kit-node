import assert from "node:assert/strict";
import test from "node:test";

import * as sdk from "../dist/index.js";

for (const exportName of [
  "RuntimeAuthContext",
  "TelemetryClient",
  "EventClient",
  "RuntimeStarter",
  "ConfigSyncCoordinator",
  "RuntimeRegistry",
  "buildRuntimeEntitiesResponse",
  "buildRuntimeHealthResponse",
  "syncRuntimeAuthFromExpressRequest",
  "syncRuntimeAuthFromFastifyRequest",
]) {
  test(`index exports ${exportName}`, () => {
    assert.ok(exportName in sdk);
  });
}
