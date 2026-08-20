# Changelog

## 0.4.0

- Added a typed automation action/event registry with behavior-contract auditing.
- Added durable file-backed action idempotency with crash-safe ambiguous-delivery handling.
- Added Express and Fastify automation dispatch adapters that honor Core's idempotency header.
- Added realistic mock event builders for automated integration testing.
- Added optional MQTT JSON sessions, source topic helpers, and packet envelopes.
- Added environment auth bootstrap and a managed runtime lifecycle with Core fetch cleanup.
- Added bounded background-task backpressure, failure counters, and cooperative shutdown.
- Added runtime config validation compatible with validator functions and schema `parse()` APIs.
- Made configuration secret redaction recursive for nested objects and arrays.

## 0.3.0

- Added validated `RuntimeDeviceRef` identity and actionable scope errors.
- Added typed, device-scoped telemetry readings with a stable observation timestamp.
- Updated event delivery to Core's idempotent `event_id/type/ts/data` envelope.
- Added device-scoped semantic event delivery with inferred runtime identity.
