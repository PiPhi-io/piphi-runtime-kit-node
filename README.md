# piphi-runtime-kit-node

Small TypeScript helpers for building PiPhi runtime integrations in Node.js.

This package is intentionally thin. It removes repetitive PiPhi runtime
plumbing without hiding the HTTP contract behind a large framework. The goal
is to make the common runtime path obvious while still letting developers own
their vendor logic.

Version `0.1.2` is the current documented baseline.

## Who this is for

This SDK is for developers building PiPhi integrations in Node.js or TypeScript.

It is a good fit if you are using:

- Express
- Fastify
- another Node HTTP framework
- a custom runtime where you still want shared PiPhi helpers

## What the SDK handles

The SDK is meant to own the shared PiPhi runtime plumbing:

- runtime auth context
- request/header auth helpers
- tiny Express and Fastify auth adapters
- process state
- background promise tracking
- telemetry delivery to PiPhi Core
- event delivery to PiPhi Core
- config sync helpers
- typed config lifecycle helpers
- discovery normalization and response helpers
- runtime health and diagnostics helpers
- in-memory runtime registry for active entries, state, and recent events
- PiPhi-specific delivery errors

## What stays in your integration

Your integration still owns vendor-specific behavior:

- vendor discovery logic
- polling behavior
- command execution
- entity mapping
- domain-specific event semantics

The SDK should make the runtime easier to write, not take over the business
logic of the device or API you are integrating.

## Install

The package supports Node `>=18`.

Install from a local checkout:

```bash
npm install /path/to/piphi-runtime-kit-node
```

Or with `pnpm`:

```bash
pnpm add /path/to/piphi-runtime-kit-node
```

## The Golden Path

If you are new to PiPhi, start here.

### 1. Create a starter

Use `createRuntimeStarter(...)` first. It gives you one obvious place to begin:

- shared runtime auth and process state
- an in-memory registry
- a telemetry client
- an event client
- a config sync coordinator

```ts
import { createRuntimeStarter } from "piphi-runtime-kit-node";

const starter = createRuntimeStarter({
  integrationId: "demo-runtime",
  integrationName: "Demo Runtime",
  version: "0.1.0",
});

const runtime = starter.runtime;
const registry = starter.registry;
const telemetry = starter.telemetryClient;
const events = starter.eventClient;
const configSync = starter.configSync;
```

### 2. Define your config shape

Keep your config model explicit so routes stay readable:

```ts
type DemoConfig = {
  id: string;
  configId?: string | null;
  integrationId?: string | null;
  containerId?: string | null;
  host: string;
  alias?: string | null;
};
```

### 3. Sync auth from every runtime request

PiPhi runtimes receive auth and scope through headers. Sync that information
before you send telemetry or events.

Framework-agnostic usage:

```ts
starter.runtime.auth.syncFromHeaders(req.headers, payload.containerId);
```

Express usage:

```ts
import { syncRuntimeAuthFromExpressRequest } from "piphi-runtime-kit-node/adapters/express";

syncRuntimeAuthFromExpressRequest(starter.runtime, req, payload.containerId);
```

Fastify usage:

```ts
import { syncRuntimeAuthFromFastifyRequest } from "piphi-runtime-kit-node/adapters/fastify";

syncRuntimeAuthFromFastifyRequest(starter.runtime, request, payload.containerId);
```

### 4. Store active runtime entries in the registry

Use the registry for the runtime working set:

```ts
registry.set(payload.id, {
  deviceId: payload.id,
  configId: payload.configId ?? payload.id,
  integrationId: payload.integrationId ?? "demo-runtime",
  host: payload.host,
});
```

PiPhi Core is still the source of truth for configs. The registry is just the
active in-memory view inside the runtime.

### 5. Send telemetry and events

You can send telemetry directly:

```ts
await telemetry.sendMetrics({
  authContext: runtime.auth,
  deviceId: "plug-1",
  metrics: { isOn: true, currentPowerW: 13.2 },
});
```

Or queue work in the background:

```ts
import {
  scheduleEventDelivery,
  scheduleTelemetryDelivery,
} from "piphi-runtime-kit-node";

scheduleTelemetryDelivery(runtime.processState, {
  telemetryClient: telemetry,
  authContext: runtime.auth,
  deviceId: "plug-1",
  metrics: { isOn: true },
  containerId: runtime.auth.containerId ?? undefined,
});

scheduleEventDelivery(runtime.processState, {
  eventClient: events,
  authContext: runtime.auth,
  eventType: "device.turned_on",
  device: {
    deviceId: "plug-1",
    configId: "core-config-uuid",
    integrationId: "demo-runtime",
  },
  source: "demo_runtime",
});
```

### 6. Expose the common runtime routes

Most runtimes should provide at least:

- `/health`
- `/diagnostics`
- `/discover`
- `/config`
- `/configs/sync` or `/config/sync`
- `/deconfigure`
- `/events`
- `/state`
- `/entities`

Some integrations also provide `/ui` or `/ui-config`.

### 7. Compare against the example app

The example apps are the intended reference implementations:

- [`examples/minimal_express_runtime/app.ts`](./examples/minimal_express_runtime/app.ts)
- [`examples/minimal_express_runtime/README.md`](./examples/minimal_express_runtime/README.md)
- [`examples/minimal_fastify_runtime/app.ts`](./examples/minimal_fastify_runtime/app.ts)
- [`examples/minimal_fastify_runtime/README.md`](./examples/minimal_fastify_runtime/README.md)

## The IDs You Need To Understand

These ids show up in most integrations:

- `id`
  The runtime's local config id.
- `configId`
  The real PiPhi Core config UUID.
- `deviceId`
  The physical or logical device identifier.
- `containerId`
  The runtime/container scope used for Core auth.
- `integrationId`
  The installed integration id in Core.

The most common mistake is confusing `id` with `configId`.

If you are sending events back to Core, `configId`, `containerId`, and
`integrationId` need to be correct.

## Typical Runtime Flow

Most integrations follow this sequence:

1. PiPhi calls your runtime.
2. Your route syncs auth from request headers.
3. You validate or normalize the incoming config payload.
4. You connect to the vendor API or local device.
5. You store the active runtime entry in the registry.
6. You poll, listen, or subscribe for changes.
7. You send telemetry to Core.
8. You emit meaningful events to Core.
9. You expose health and diagnostics for supportability.

The SDK is designed to make steps `2`, `5`, `7`, `8`, and `9` easier.

## Thin framework adapters

The Node kit includes small request adapters for Express and Fastify. They are
deliberately narrow. They help with auth extraction and log formatting, but
they do not try to hide the framework.

Express example:

```ts
import {
  formatExpressRuntimeAuthSyncLog,
  syncRuntimeAuthFromExpressRequest,
} from "piphi-runtime-kit-node/adapters/express";

syncRuntimeAuthFromExpressRequest(runtime, req, payload.containerId);
logger.info(formatExpressRuntimeAuthSyncLog(req, payload.containerId));
```

Fastify example:

```ts
import {
  formatFastifyRuntimeAuthSyncLog,
  syncRuntimeAuthFromFastifyRequest,
} from "piphi-runtime-kit-node/adapters/fastify";

syncRuntimeAuthFromFastifyRequest(runtime, request, payload.containerId);
logger.info(formatFastifyRuntimeAuthSyncLog(request, payload.containerId));
```

## Clear Error Handling

The SDK classifies common delivery failures into PiPhi-specific errors.

Important examples:

- `CoreUnavailableError`
  PiPhi Core could not be reached.
- `CoreTimeoutError`
  PiPhi Core did not respond before the timeout.
- `CoreRouteNotFoundError`
  The expected Core endpoint is missing or the base URL is wrong.
- `CoreAuthError`
  Core rejected runtime auth.
- `CoreServerError`
  Core failed while processing the request.

This is meant to be easier to understand than raw transport exceptions alone.

## Common Mistakes

- Using `id` where `configId` should be used.
- Forgetting to sync auth before sending telemetry.
- Sending events without `configId`, `containerId`, or `integrationId`.
- Treating the runtime registry as the source of truth.
- Expecting the SDK to own polling cadence or vendor protocol logic.

## Troubleshooting

If telemetry or event delivery fails:

- confirm Core is reachable
- confirm the base URL is correct
- confirm `containerId` is present
- confirm `configId` is the real Core config UUID
- read the classified SDK error before digging into lower-level traces

If config sync behaves incorrectly:

- verify you are storing the right active ids
- verify the sync generation coming from Core
- verify stale entries are removed

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
    errors.ts
    events.ts
    health.ts
    registry.ts
    state.ts
    starter.ts
    tasks.ts
    telemetry.ts
```

## Summary

If you are unsure where to start:

1. create a starter
2. sync auth in every route
3. keep config identity straight
4. use the registry for active runtime state
5. send telemetry and events through the SDK
6. compare your code to the example app
