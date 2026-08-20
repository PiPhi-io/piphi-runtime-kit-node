import { randomUUID } from "node:crypto";
import { classifyCoreDeliveryError } from "./errors.js";
import { buildCoreAuthHeaders } from "./telemetry.js";
import { RuntimeDeviceRef } from "./identity.js";
/**
 * Normalize an integration event payload into a plain object.
 */
export function normalizeEventPayload(payload) {
    return {
        ...payload,
        payload: payload.payload ?? {},
    };
}
/**
 * Build a Core-bound event payload with explicit routing ids.
 */
export function buildCoreEventPayload(values) {
    const data = { ...(values.payload ?? {}) };
    if (values.source && data.source === undefined)
        data.source = values.source;
    return {
        eventId: values.eventId ?? randomUUID(),
        type: values.eventType,
        ts: values.ts instanceof Date
            ? values.ts.toISOString()
            : (values.ts ?? new Date().toISOString()),
        integrationId: values.integrationId,
        configId: values.configId,
        containerId: values.containerId,
        ...(values.deviceId ? { deviceId: values.deviceId } : {}),
        severity: values.severity ?? "info",
        transport: values.transport ?? "rest",
        ...(values.topic ? { topic: values.topic } : {}),
        data,
    };
}
/**
 * Build a standard local event-ingest response.
 */
export function buildEventIngestResponse(event) {
    return { ok: true, event };
}
/**
 * Build a standard local event-list response.
 */
export function buildEventListResponse(events) {
    return { events };
}
/**
 * Format a concise event log line.
 */
export function formatEventLog(payload) {
    return [
        "event_ingest",
        `event_type=${payload.eventType}`,
        `device_id=${payload.deviceId ?? "<missing>"}`,
        `config_id=${payload.configId ?? "<missing>"}`,
    ].join(" ");
}
function normalizeCoreBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "").replace(/\/api\/v2$/, "");
}
/**
 * Thin client for delivering runtime events back to PiPhi Core.
 */
export class EventClient {
    processState;
    coreBaseUrl;
    timeoutMs;
    eventsPath;
    constructor(options) {
        this.processState = options.processState;
        this.coreBaseUrl = normalizeCoreBaseUrl(options.coreBaseUrl ?? options.processState.coreBaseUrl);
        this.timeoutMs = options.timeoutMs ?? 3000;
        this.eventsPath = "/api/v2/events/ingest";
    }
    /**
     * Send one event payload to PiPhi Core.
     */
    async sendEvent(options) {
        const coreFetch = this.processState.coreFetch ?? fetch;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const eventsUrl = `${this.coreBaseUrl}${this.eventsPath}`;
        try {
            const response = await coreFetch(eventsUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildCoreAuthHeaders(options.authContext),
                },
                body: JSON.stringify({
                    event_id: options.event.eventId,
                    type: options.event.type,
                    ts: options.event.ts,
                    integration_id: options.event.integrationId,
                    config_id: options.event.configId,
                    container_id: options.event.containerId,
                    ...(options.event.deviceId ? { device_id: options.event.deviceId } : {}),
                    severity: options.event.severity,
                    transport: options.event.transport,
                    ...(options.event.topic ? { topic: options.event.topic } : {}),
                    data: options.event.data,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                throw classifyCoreDeliveryError({
                    error: null,
                    operation: "event_delivery",
                    url: eventsUrl,
                    timeoutMs: this.timeoutMs,
                    response,
                });
            }
        }
        catch (error) {
            if (error instanceof Error && "operation" in error && "retryable" in error) {
                throw error;
            }
            throw classifyCoreDeliveryError({
                error,
                operation: "event_delivery",
                url: eventsUrl,
                timeoutMs: this.timeoutMs,
            });
        }
        finally {
            clearTimeout(timer);
        }
    }
    async sendDeviceEvent(options) {
        const device = options.device instanceof RuntimeDeviceRef
            ? options.device.requireEventScope()
            : RuntimeDeviceRef.fromValue(options.device, {
                containerId: options.authContext.containerId,
            }).requireEventScope();
        await this.sendEvent({
            authContext: options.authContext,
            event: buildCoreEventPayload({
                eventType: options.eventType,
                integrationId: device.integrationId,
                configId: device.configId,
                containerId: device.containerId,
                deviceId: device.deviceId,
                ...(options.payload ? { payload: options.payload } : {}),
                ...(options.source ? { source: options.source } : {}),
                ...(options.severity ? { severity: options.severity } : {}),
                ...(options.topic ? { topic: options.topic } : {}),
                ...(options.eventId ? { eventId: options.eventId } : {}),
                ...(options.ts ? { ts: options.ts } : {}),
            }),
        });
    }
}
