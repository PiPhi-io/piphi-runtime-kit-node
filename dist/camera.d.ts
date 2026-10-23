export declare const CAMERA_MEDIA_CONTRACT_VERSION: "camera.media.v1";
export declare const CAMERA_MAX_SDP_BYTES: number;
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
export declare function cameraManifestCapability(declaration: CameraCapabilityDeclaration): Record<string, unknown>;
export declare function assertCameraCapability(declaration: CameraCapabilityDeclaration): void;
export declare function assertCameraSource(source: CameraSourceDescriptor): void;
