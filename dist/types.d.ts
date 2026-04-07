export interface RuntimeConfig {
    id: string;
    configId?: string;
    containerId?: string | null;
    integrationId?: string | null;
    deviceId?: string | null;
}
export interface RuntimeConfigApplyResponse {
    ok: true;
    configId: string;
    containerId?: string | null;
    metadata?: Record<string, unknown>;
}
export interface RuntimeConfigRemoveResponse {
    ok: true;
    configId: string;
    removed: boolean;
}
export interface RuntimeConfigSnapshot<TConfig = RuntimeConfig> {
    containerId?: string | null;
    integrationId?: string | null;
    generation?: number | null;
    configs: TConfig[];
}
export interface RuntimeConfigSyncResponse {
    ok: true;
    appliedConfigIds: string[];
    removedConfigIds: string[];
    skippedConfigIds: string[];
    generation?: number | null;
}
export interface IntegrationDiscoveryRequest {
    inputs?: Record<string, unknown>;
}
export interface IntegrationDiscoveryResponse<TDevice = Record<string, unknown>> {
    devices: TDevice[];
}
export interface IntegrationEventRequest {
    eventType: string;
    source?: string;
    severity?: "debug" | "info" | "warning" | "error";
    payload?: Record<string, unknown>;
    deviceId?: string | null;
    configId?: string | null;
    containerId?: string | null;
    integrationId?: string | null;
}
export interface IntegrationEventIngestResponse<TEvent = Record<string, unknown>> {
    ok: true;
    event: TEvent;
}
export interface IntegrationEventListResponse<TEvent = Record<string, unknown>> {
    events: TEvent[];
}
export interface RuntimeHealthResponse {
    ok: true;
    integration?: Record<string, unknown>;
    runtimeAuthPresent: boolean;
    coreClientBound: boolean;
    pendingTaskCount: number;
    currentGeneration?: number | null;
    metadata?: Record<string, unknown>;
}
export interface RuntimeDiagnosticsResponse {
    ok: true;
    integration?: Record<string, unknown>;
    runtimeAuthPresent: boolean;
    coreClientBound: boolean;
    pendingTaskCount: number;
    currentGeneration?: number | null;
    diagnostics?: Record<string, unknown>;
}
export interface TelemetryPayload {
    deviceId: string;
    metrics: Record<string, unknown>;
    units?: Record<string, string>;
    containerId?: string | null;
    integrationId?: string | null;
}
export interface CoreEventPayload {
    eventType: string;
    source?: string;
    severity?: "debug" | "info" | "warning" | "error";
    payload?: Record<string, unknown>;
    configId: string;
    containerId: string;
    integrationId: string;
    deviceId?: string | null;
}
