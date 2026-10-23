import assert from "node:assert/strict";
import test from "node:test";
import { assertCameraSource, cameraManifestCapability } from "../dist/index.js";

test("builds a versioned camera manifest declaration", () => {
  assert.deepEqual(cameraManifestCapability({
    contractVersion: "camera.media.v1", messageType: "camera.capability",
    capabilityId: "camera_stream", transports: ["webrtc"],
    endpoints: { source: "/v1/cameras/{config_id}/source" },
  }), { kind: "camera", value_kind: "camera", camera: {
    contract_version: "camera.media.v1", refresh_seconds: 15,
    gateway_source_endpoint: "/v1/cameras/{config_id}/source",
  }});
});

test("validates private sources and rejects protocol mismatch", () => {
  const source = { contract_version: "camera.media.v1", message_type: "camera.source", audience: "core-sidecar", camera_id: "front-door", source_url: "rtsps://user:secret@camera.local/live", source_protocol: "rtsps" };
  assert.doesNotThrow(() => assertCameraSource(source));
  assert.throws(() => assertCameraSource({ ...source, source_protocol: "rtsp" }), /must match/);
});

test("rejects endpoint traversal", () => {
  assert.throws(() => cameraManifestCapability({ contractVersion: "camera.media.v1", messageType: "camera.capability", capabilityId: "camera_stream", transports: ["webrtc"], endpoints: { source: "/v1/../secret" } }), /path-only/);
});
