# piphi-runtime-kit-node

Small TypeScript helpers for building PiPhi runtime integrations in Node.js.

This package is intentionally thin. It removes repetitive PiPhi runtime
plumbing without hiding the HTTP contract behind a large framework.

## Initial scope

Version `0.1.x` focuses on:

- runtime auth context
- request/header auth helpers
- process state
- background promise tracking
- telemetry delivery to PiPhi Core
- event delivery to PiPhi Core
- config sync helpers
- typed config lifecycle helpers
- discovery normalization and response helpers
- runtime health and diagnostics helpers
- in-memory runtime registry for active entries/state/events

This is the framework-agnostic base layer. It also includes very small
request-auth adapters for Express and Fastify on top of these primitives.

## Design goals

- keep the API explicit and easy to read
- avoid hidden global state
- stay close to the PiPhi HTTP contract
- be usable from any Node HTTP framework
- rely on platform-native primitives like `fetch` when possible

## Core Example

```ts
import {
  RuntimeContext,
  RuntimeRegistry,
  TelemetryClient,
  createTrackedTask,
} from "piphi-runtime-kit-node";

const runtime = new RuntimeContext();
runtime.auth.update({
  containerId: "runtime-123",
  internalToken: "secret-token",
});

const registry = new RuntimeRegistry<Record<string, unknown>>();
registry.set("plug-1", { deviceId: "plug-1", host: "10.0.0.227" });

const telemetry = new TelemetryClient({ processState: runtime.processState });

createTrackedTask(runtime.processState, Promise.resolve("ready"));

await telemetry.sendMetrics({
  authContext: runtime.auth,
  deviceId: "plug-1",
  metrics: { isOn: true, currentPowerW: 13.2 },
});
```

## Example Apps

- [`examples/minimal_express_runtime/app.ts`](./examples/minimal_express_runtime/app.ts)
  shows a small Express runtime using the shared auth adapter, registry,
  config helpers, discovery helpers, and health diagnostics builders.
- [`examples/minimal_express_runtime/README.md`](./examples/minimal_express_runtime/README.md)
  explains the routes and the intended usage patterns.
- [`examples/minimal_fastify_runtime/app.ts`](./examples/minimal_fastify_runtime/app.ts)
  shows the same runtime shape using the Fastify adapter helpers.
- [`examples/minimal_fastify_runtime/README.md`](./examples/minimal_fastify_runtime/README.md)
  explains the Fastify-focused request-auth pattern.

## Current package shape

```text
src/
  index.ts
  types.ts
  adapters/
    express.ts
    fastify.ts
  runtime/
    auth.ts
    config-sync.ts
    configuration.ts
    context.ts
    discovery.ts
    dispatch.ts
    events.ts
    health.ts
    registry.ts
    state.ts
    tasks.ts
    telemetry.ts
```

## Thin framework adapters

The Node kit also includes tiny request adapters for Express and Fastify.
They only cover repetitive request auth extraction and payload container lookup.

Express adapter example:

```ts
import {
  formatExpressRuntimeAuthSyncLog,
  syncRuntimeAuthFromExpressRequest,
} from "piphi-runtime-kit-node/adapters/express";

syncRuntimeAuthFromExpressRequest(runtime, req);
logger.info(formatExpressRuntimeAuthSyncLog(req));
```

Fastify adapter example:

```ts
import {
  formatFastifyRuntimeAuthSyncLog,
  syncRuntimeAuthFromFastifyRequest,
} from "piphi-runtime-kit-node/adapters/fastify";

syncRuntimeAuthFromFastifyRequest(runtime, request);
logger.info(formatFastifyRuntimeAuthSyncLog(request));
```

## What stays outside the SDK

The SDK should cover PiPhi runtime plumbing, not vendor logic.

The following should stay inside each integration:

- vendor discovery logic
- polling behavior
- command execution
- vendor entity transformation
- integration-specific event semantics

## Next steps

- add a minimal Fastify example alongside the Express one
- add a conformance CLI that validates runtime endpoints against the PiPhi contract
- keep the adapters thin and focused on request-auth extraction
