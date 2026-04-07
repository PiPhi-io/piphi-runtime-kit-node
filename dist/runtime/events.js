import { classifyCoreDeliveryError } from "./errors.js";
import { buildCoreAuthHeaders } from "./telemetry.js";
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
    return values;
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
                body: JSON.stringify(options.event),
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
}
