# Minimal Express Runtime Example

This example is meant to teach in two layers:

- a beginner path for a first successful PiPhi runtime
- an advanced path for targeted per-device event and telemetry flows

## What it demonstrates

- starting from `createRuntimeStarter(...)`
- syncing request auth with `syncRuntimeAuthFromExpressRequest(...)`
- using `RuntimeRegistry` for active runtime state
- standard config apply, sync, and remove responses
- standard health and diagnostics responses
- standard discovery and local event responses
- queued telemetry delivery back to PiPhi Core
- targeted event and telemetry examples for a specific configured device

## Beginner route flow

Start with these routes first:

- `GET /health`
- `GET /diagnostics`
- `POST /discover`
- `POST /config`
- `GET /state`
- `POST /events/example`
- `POST /telemetry/example`

## Advanced route flow

These routes are closer to a real integration:

- `POST /config/sync`
- `POST /deconfigure/:configId`
- `POST /events/device/:configId/example`
- `POST /telemetry/device/:configId/example`

They show how to:

- target a specific configured device
- keep `configId` and `deviceId` straight
- record config lifecycle events
- queue telemetry for a chosen device instead of just the primary one

## Suggested reading order

1. read the starter creation
2. read `buildEntry(...)`
3. read `applyConfig(...)`
4. read `POST /config`
5. read `POST /telemetry/example`
6. read the targeted device routes

This example is intentionally illustrative. It is not included in the package
build, so integration authors can read it as a reference without the core
package taking on an Express dependency.
