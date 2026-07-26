import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
import { createTrackedTask } from "./tasks.js";
import { EventClient, buildCoreEventPayload } from "./events.js";
import { TelemetryClient } from "./telemetry.js";
import { resolveConfigId } from "./identity.js";

/**
 * Build a local event record before persisting or returning it.
 */
export function buildLocalEventRecord<TEvent extends Record<string, unknown>>(event: TEvent): TEvent {
  return {
    receivedAt: new Date().toISOString(),
    ...event,
  } as TEvent;
}

/**
 * Dispatch one telemetry delivery task in the background.
 */
export function scheduleTelemetryDelivery(options: {
  processState: RuntimeProcessState;
  telemetryClient: TelemetryClient;
  authContext: RuntimeAuthContext;
  deviceId: string;
  configId?: string | null;
  metrics: Record<string, boolean | number | string>;
  units?: Record<string, string>;
  timestamp?: string;
  containerId?: string | null;
}): Promise<void> {
  const telemetryOptions: {
    authContext: RuntimeAuthContext;
    deviceId: string;
    configId?: string | null;
    metrics: Record<string, boolean | number | string>;
    units?: Record<string, string>;
    timestamp?: string;
    containerId?: string | null;
  } = {
    authContext: options.authContext,
    deviceId: options.deviceId,
    metrics: options.metrics,
    timestamp: options.timestamp ?? new Date().toISOString(),
  };

  if (options.units !== undefined) {
    telemetryOptions.units = options.units;
  }

  if (options.configId !== undefined) {
    telemetryOptions.configId = options.configId;
  }

  if (options.containerId !== undefined) {
    telemetryOptions.containerId = options.containerId;
  }

  return createTrackedTask(
    options.processState,
    options.telemetryClient.sendMetrics(telemetryOptions),
  );
}

/**
 * Dispatch one Core event delivery task in the background.
 */
export function scheduleEventDelivery(options: {
  processState: RuntimeProcessState;
  eventClient: EventClient;
  authContext: RuntimeAuthContext;
  eventType: string;
  device: Record<string, unknown>;
  payload?: Record<string, unknown>;
  source?: string;
  severity?: "info" | "warning" | "error" | "critical";
  topic?: string | null;
  eventId?: string;
  ts?: string | Date;
}): Promise<void> {
  const coreEvent = buildCoreEventPayload({
    eventType: options.eventType,
    ...(options.source ? { source: options.source } : {}),
    ...(options.payload ? { payload: options.payload } : {}),
    ...(options.severity ? { severity: options.severity } : {}),
    ...(options.topic ? { topic: options.topic } : {}),
    ...(options.eventId ? { eventId: options.eventId } : {}),
    ...(options.ts ? { ts: options.ts } : {}),
    configId:
      "configId" in options.device ? resolveConfigId(options.device as Record<string, unknown>) : "",
    containerId: String(options.device.containerId ?? options.authContext.containerId ?? ""),
    integrationId: String(options.device.integrationId ?? ""),
    ...(options.device.deviceId ? { deviceId: String(options.device.deviceId) } : {}),
  });

  return createTrackedTask(
    options.processState,
    options.eventClient.sendEvent({
      authContext: options.authContext,
      event: coreEvent,
    }),
  );
}

export const dispatchTelemetryDelivery = scheduleTelemetryDelivery;
export const dispatchEventDelivery = scheduleEventDelivery;
