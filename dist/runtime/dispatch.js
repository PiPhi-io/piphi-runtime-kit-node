import { createTrackedTask } from "./tasks.js";
import { buildCoreEventPayload } from "./events.js";
import { resolveConfigId } from "./identity.js";
/** Retry only errors explicitly classified by the SDK as safe to retry. */
export async function runWithRetryableCoreDeliveryBackoff(operation, options = {}) {
    const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
    const baseDelayMs = Math.max(0, options.baseDelayMs ?? 100);
    const maximumDelayMs = Math.max(baseDelayMs, options.maximumDelayMs ?? 2_000);
    const sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    for (let attempt = 1;; attempt += 1) {
        try {
            return await operation();
        }
        catch (error) {
            if (!isRetryableDeliveryError(error) || attempt >= maxAttempts)
                throw error;
            await sleep(Math.min(maximumDelayMs, baseDelayMs * 2 ** (attempt - 1)));
        }
    }
}
/**
 * Build a local event record before persisting or returning it.
 */
export function buildLocalEventRecord(event) {
    return {
        receivedAt: new Date().toISOString(),
        ...event,
    };
}
/**
 * Dispatch one telemetry delivery task in the background.
 */
export function scheduleTelemetryDelivery(options) {
    const telemetryOptions = {
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
    return createTrackedTask(options.processState, runWithRetryableCoreDeliveryBackoff(() => options.telemetryClient.sendMetrics(telemetryOptions), options.retry));
}
/**
 * Dispatch one Core event delivery task in the background.
 */
export function scheduleEventDelivery(options) {
    const coreEvent = buildCoreEventPayload({
        eventType: options.eventType,
        ...(options.source ? { source: options.source } : {}),
        ...(options.payload ? { payload: options.payload } : {}),
        ...(options.severity ? { severity: options.severity } : {}),
        ...(options.topic ? { topic: options.topic } : {}),
        ...(options.eventId ? { eventId: options.eventId } : {}),
        ...(options.ts ? { ts: options.ts } : {}),
        configId: "configId" in options.device ? resolveConfigId(options.device) : "",
        containerId: String(options.device.containerId ?? options.authContext.containerId ?? ""),
        integrationId: String(options.device.integrationId ?? ""),
        ...(options.device.deviceId ? { deviceId: String(options.device.deviceId) } : {}),
    });
    return createTrackedTask(options.processState, runWithRetryableCoreDeliveryBackoff(() => options.eventClient.sendEvent({
        authContext: options.authContext,
        event: coreEvent,
    }), options.retry));
}
function isRetryableDeliveryError(error) {
    return error !== null && typeof error === "object" && "retryable" in error
        && error.retryable === true;
}
export const dispatchTelemetryDelivery = scheduleTelemetryDelivery;
export const dispatchEventDelivery = scheduleEventDelivery;
