import type {
  CoreEventPayload,
  IntegrationEventIngestResponse,
  IntegrationEventListResponse,
  IntegrationEventRequest,
} from "../types.js";
import { classifyCoreDeliveryError } from "./errors.js";
import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
import { buildCoreAuthHeaders } from "./telemetry.js";

/**
 * Normalize an integration event payload into a plain object.
 */
export function normalizeEventPayload(payload: IntegrationEventRequest): IntegrationEventRequest {
  return {
    ...payload,
    payload: payload.payload ?? {},
  };
}

/**
 * Build a Core-bound event payload with explicit routing ids.
 */
export function buildCoreEventPayload(values: CoreEventPayload): CoreEventPayload {
  return values;
}

/**
 * Build a standard local event-ingest response.
 */
export function buildEventIngestResponse<TEvent extends object>(
  event: TEvent,
): IntegrationEventIngestResponse<TEvent> {
  return { ok: true, event };
}

/**
 * Build a standard local event-list response.
 */
export function buildEventListResponse<TEvent extends object>(
  events: TEvent[],
): IntegrationEventListResponse<TEvent> {
  return { events };
}

/**
 * Format a concise event log line.
 */
export function formatEventLog(payload: IntegrationEventRequest): string {
  return [
    "event_ingest",
    `event_type=${payload.eventType}`,
    `device_id=${payload.deviceId ?? "<missing>"}`,
    `config_id=${payload.configId ?? "<missing>"}`,
  ].join(" ");
}

export interface EventClientOptions {
  processState: RuntimeProcessState;
  coreBaseUrl?: string;
  timeoutMs?: number;
}

function normalizeCoreBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "").replace(/\/api\/v2$/, "");
}

/**
 * Thin client for delivering runtime events back to PiPhi Core.
 */
export class EventClient {
  private readonly processState: RuntimeProcessState;
  private readonly coreBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly eventsPath: string;

  constructor(options: EventClientOptions) {
    this.processState = options.processState;
    this.coreBaseUrl = normalizeCoreBaseUrl(
      options.coreBaseUrl ?? options.processState.coreBaseUrl,
    );
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.eventsPath = "/api/v2/events/ingest";
  }

  /**
   * Send one event payload to PiPhi Core.
   */
  async sendEvent(options: {
    authContext: RuntimeAuthContext;
    event: CoreEventPayload;
  }): Promise<void> {
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
    } catch (error) {
      if (error instanceof Error && "operation" in error && "retryable" in error) {
        throw error;
      }
      throw classifyCoreDeliveryError({
        error,
        operation: "event_delivery",
        url: eventsUrl,
        timeoutMs: this.timeoutMs,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
