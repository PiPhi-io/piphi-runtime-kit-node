import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
import { createTrackedTask } from "./tasks.js";
import { EventClient, buildCoreEventPayload } from "./events.js";
import { TelemetryClient } from "./telemetry.js";
import { resolveConfigId } from "./identity.js";

export interface CoreDeliveryRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maximumDelayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
}

/** Retry only errors explicitly classified by the SDK as safe to retry. */
export async function runWithRetryableCoreDeliveryBackoff<T>(
  operation: () => Promise<T>,
  options: CoreDeliveryRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 100);
  const maximumDelayMs = Math.max(baseDelayMs, options.maximumDelayMs ?? 2_000);
  const sleep = options.sleep ?? ((delayMs) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableDeliveryError(error) || attempt >= maxAttempts) throw error;
      await sleep(Math.min(maximumDelayMs, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
}

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
  retry?: CoreDeliveryRetryOptions;
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
    runWithRetryableCoreDeliveryBackoff(
      () => options.telemetryClient.sendMetrics(telemetryOptions),
      options.retry,
    ),
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
  retry?: CoreDeliveryRetryOptions;
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
    runWithRetryableCoreDeliveryBackoff(
      () => options.eventClient.sendEvent({
        authContext: options.authContext,
        event: coreEvent,
      }),
      options.retry,
    ),
  );
}

function isRetryableDeliveryError(error: unknown): error is { retryable: true } {
  return error !== null && typeof error === "object" && "retryable" in error
    && (error as { retryable?: unknown }).retryable === true;
}

export const dispatchTelemetryDelivery = scheduleTelemetryDelivery;
export const dispatchEventDelivery = scheduleEventDelivery;
