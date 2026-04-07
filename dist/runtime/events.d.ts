import type { CoreEventPayload, IntegrationEventIngestResponse, IntegrationEventListResponse, IntegrationEventRequest } from "../types.js";
import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
/**
 * Normalize an integration event payload into a plain object.
 */
export declare function normalizeEventPayload(payload: IntegrationEventRequest): IntegrationEventRequest;
/**
 * Build a Core-bound event payload with explicit routing ids.
 */
export declare function buildCoreEventPayload(values: CoreEventPayload): CoreEventPayload;
/**
 * Build a standard local event-ingest response.
 */
export declare function buildEventIngestResponse<TEvent extends object>(event: TEvent): IntegrationEventIngestResponse<TEvent>;
/**
 * Build a standard local event-list response.
 */
export declare function buildEventListResponse<TEvent extends object>(events: TEvent[]): IntegrationEventListResponse<TEvent>;
/**
 * Format a concise event log line.
 */
export declare function formatEventLog(payload: IntegrationEventRequest): string;
export interface EventClientOptions {
    processState: RuntimeProcessState;
    coreBaseUrl?: string;
    timeoutMs?: number;
}
/**
 * Thin client for delivering runtime events back to PiPhi Core.
 */
export declare class EventClient {
    private readonly processState;
    private readonly coreBaseUrl;
    private readonly timeoutMs;
    private readonly eventsPath;
    constructor(options: EventClientOptions);
    /**
     * Send one event payload to PiPhi Core.
     */
    sendEvent(options: {
        authContext: RuntimeAuthContext;
        event: CoreEventPayload;
    }): Promise<void>;
}
