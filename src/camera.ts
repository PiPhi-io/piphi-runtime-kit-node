export const CAMERA_MEDIA_CONTRACT_VERSION = "camera.media.v1" as const;
export const CAMERA_MAX_SDP_BYTES = 256 * 1024;

export type CameraMediaTransport = "snapshot" | "webrtc" | "hls";
export type CameraSourceProtocol = "rtsp" | "rtsps" | "http" | "https";

export interface CameraCapabilityEndpoints {
  source?: string;
  snapshot?: string;
  events?: string;
  hls?: string;
  webrtc?: string;
  webrtcClose?: string;
}

export interface CameraCapabilityDeclaration {
  contractVersion: typeof CAMERA_MEDIA_CONTRACT_VERSION;
  messageType: "camera.capability";
  capabilityId: string;
  transports: CameraMediaTransport[];
  audioAvailable?: boolean;
  recordingAvailable?: boolean;
  refreshSeconds?: number;
  endpoints: CameraCapabilityEndpoints;
}

export interface CameraSourceDescriptor {
  contract_version: typeof CAMERA_MEDIA_CONTRACT_VERSION;
  message_type: "camera.source";
  audience: "core-sidecar";
  camera_id: string;
  source_url: string;
  source_protocol: CameraSourceProtocol;
  preferred_transport?: "tcp" | "udp" | "auto";
  connect_timeout_seconds?: number;
}

export interface CameraWebRtcOffer {
  type: "offer";
  sdp: string;
  include_audio?: boolean;
}

export interface CameraSidecarSessionOpen {
  contract_version: typeof CAMERA_MEDIA_CONTRACT_VERSION;
  message_type: "camera.sidecar.session.open";
  audience: "core-sidecar";
  source: CameraSourceDescriptor;
  offer: CameraWebRtcOffer;
  idle_timeout_seconds?: number;
}

export function cameraManifestCapability(declaration: CameraCapabilityDeclaration): Record<string, unknown> {
  assertCameraCapability(declaration);
  const camera: Record<string, unknown> = {
    contract_version: CAMERA_MEDIA_CONTRACT_VERSION,
    refresh_seconds: declaration.refreshSeconds ?? 15,
  };
  const names: Array<[keyof CameraCapabilityEndpoints, string]> = [
    ["source", "gateway_source_endpoint"], ["snapshot", "snapshot_endpoint"],
    ["events", "events_endpoint"], ["hls", "stream_endpoint"],
    ["webrtc", "webrtc_endpoint"], ["webrtcClose", "webrtc_close_endpoint"],
  ];
  for (const [field, manifestField] of names) {
    const value = declaration.endpoints[field];
    if (value) camera[manifestField] = value;
  }
  if (declaration.transports.includes("hls")) camera.stream_type = "hls";
  return { kind: "camera", value_kind: "camera", camera };
}

export function assertCameraCapability(declaration: CameraCapabilityDeclaration): void {
  if (declaration.contractVersion !== CAMERA_MEDIA_CONTRACT_VERSION || declaration.messageType !== "camera.capability") throw new Error("Camera capability must use camera.media.v1.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,299}$/.test(declaration.capabilityId)) throw new Error("Invalid camera capability id.");
  if (!declaration.transports.length || new Set(declaration.transports).size !== declaration.transports.length) throw new Error("Camera transports must be non-empty and unique.");
  const endpoints = Object.values(declaration.endpoints).filter((value): value is string => typeof value === "string");
  if (!endpoints.length || endpoints.some((value) => !isSafeEndpoint(value))) throw new Error("Camera endpoints must be safe path-only values.");
}

export function assertCameraSource(source: CameraSourceDescriptor): void {
  if (source.contract_version !== CAMERA_MEDIA_CONTRACT_VERSION || source.message_type !== "camera.source" || source.audience !== "core-sidecar") throw new Error("Invalid private camera source envelope.");
  if (source.source_url.length > 4096 || /[\r\n\0]/.test(source.source_url)) throw new Error("Invalid camera source URL.");
  const parsed = new URL(source.source_url);
  if (parsed.protocol.slice(0, -1) !== source.source_protocol || !parsed.hostname) throw new Error("Camera source URL and protocol must match.");
}

function isSafeEndpoint(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.split("/").some((part) => part === "." || part === "..");
}
