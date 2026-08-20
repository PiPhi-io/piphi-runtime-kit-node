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
  schemaVersion?: number | null;
  containerId?: string | null;
  integrationId?: string | null;
  driverPid?: number | null;
  reason?: string | null;
  generation?: number | null;
  updatedAt?: string | null;
  configs: TConfig[];
  deletedConfigIds?: string[];
  configHash?: string | null;
  internalToken?: string | null;
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

export interface RuntimeEntityDashboard {
  allowedWidgets?: string[];
  defaultWidget?: string | null;
  recommendedWidgets?: string[];
  metadata?: Record<string, unknown>;
}

export interface RuntimeEntity {
  id: string;
  name: string;
  capabilities: string[];
  configId?: string | null;
  deviceId?: string | null;
  deviceType?: string | null;
  deviceClass?: string | null;
  entityType?: string | null;
  dashboard?: RuntimeEntityDashboard | null;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RuntimeEntitiesResponse<TEntity extends RuntimeEntity = RuntimeEntity> {
  entities: TEntity[];
  capabilities?: Record<string, unknown>;
  commands?: Record<string, unknown>;
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
  maxBackgroundTaskCount: number;
  backgroundTaskFailureCount: number;
  backgroundTaskRejectedCount: number;
  currentGeneration?: number | null;
  configGeneration?: number | null;
  metadata?: Record<string, unknown>;
}

export interface RuntimeDiagnosticsResponse {
  ok: true;
  integration?: Record<string, unknown>;
  runtimeAuthPresent: boolean;
  coreClientBound: boolean;
  pendingTaskCount: number;
  maxBackgroundTaskCount: number;
  backgroundTaskFailureCount: number;
  backgroundTaskRejectedCount: number;
  currentGeneration?: number | null;
  configGeneration?: number | null;
  diagnostics?: Record<string, unknown>;
}

export interface TelemetryPayload {
  deviceId: string;
  configId?: string | null;
  metrics: Record<string, boolean | number | string>;
  units?: Record<string, string>;
  timestamp: string;
  containerId?: string | null;
  integrationId?: string | null;
}

export interface CoreEventPayload {
  eventId: string;
  type: string;
  ts: string;
  integrationId: string;
  configId: string;
  containerId: string;
  deviceId?: string | null;
  severity: "info" | "warning" | "error" | "critical";
  transport: "rest" | "mqtt";
  topic?: string | null;
  data: Record<string, unknown>;
}
