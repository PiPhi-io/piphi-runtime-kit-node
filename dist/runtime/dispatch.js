import { createTrackedTask } from "./tasks.js";
import { buildCoreEventPayload } from "./events.js";
import { resolveConfigId } from "./identity.js";
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
    return createTrackedTask(options.processState, options.telemetryClient.sendMetrics(telemetryOptions));
}
/**
 * Dispatch one Core event delivery task in the background.
 */
export function scheduleEventDelivery(options) {
    const coreEvent = buildCoreEventPayload({
        eventType: options.eventType,
        ...(options.source ? { source: options.source } : {}),
        ...(options.payload ? { payload: options.payload } : {}),
        configId: "configId" in options.device ? resolveConfigId(options.device) : "",
        containerId: String(options.device.containerId ?? options.authContext.containerId ?? ""),
        integrationId: String(options.device.integrationId ?? ""),
        ...(options.device.deviceId ? { deviceId: String(options.device.deviceId) } : {}),
    });
    return createTrackedTask(options.processState, options.eventClient.sendEvent({
        authContext: options.authContext,
        event: coreEvent,
    }));
}
export const dispatchTelemetryDelivery = scheduleTelemetryDelivery;
export const dispatchEventDelivery = scheduleEventDelivery;
