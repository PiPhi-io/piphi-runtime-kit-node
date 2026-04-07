# Minimal Express Runtime Example

This example shows the intended shape of a small PiPhi runtime integration
using the Node runtime kit with Express.

It demonstrates:

- syncing request auth with `syncRuntimeAuthFromExpressRequest(...)`
- using `RuntimeContext` and `RuntimeRegistry` for runtime state
- standard config apply and remove responses
- standard health and diagnostics responses
- standard discovery and local event responses
- queued telemetry delivery back to PiPhi Core

Key routes in the example:

- `GET /health`
- `GET /diagnostics`
- `POST /discover`
- `POST /config`
- `POST /deconfigure/:configId`
- `GET /state`
- `POST /events/example`
- `GET /events`
- `POST /telemetry/example`

This example is intentionally illustrative. It is not included in the package
build, so integration authors can read it as a reference without the core
package taking on an Express dependency.
