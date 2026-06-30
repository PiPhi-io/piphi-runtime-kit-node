import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
import { EventClient } from "./events.js";
import { TelemetryClient } from "./telemetry.js";
/**
 * Build a local event record before persisting or returning it.
 */
export declare function buildLocalEventRecord<TEvent extends Record<string, unknown>>(event: TEvent): TEvent;
/**
 * Dispatch one telemetry delivery task in the background.
 */
export declare function scheduleTelemetryDelivery(options: {
    processState: RuntimeProcessState;
    telemetryClient: TelemetryClient;
    authContext: RuntimeAuthContext;
    deviceId: string;
    configId?: string | null;
    metrics: Record<string, unknown>;
    units?: Record<string, string>;
    containerId?: string | null;
}): Promise<void>;
/**
 * Dispatch one Core event delivery task in the background.
 */
export declare function scheduleEventDelivery(options: {
    processState: RuntimeProcessState;
    eventClient: EventClient;
    authContext: RuntimeAuthContext;
    eventType: string;
    device: Record<string, unknown>;
    payload?: Record<string, unknown>;
    source?: string;
}): Promise<void>;
export declare const dispatchTelemetryDelivery: typeof scheduleTelemetryDelivery;
export declare const dispatchEventDelivery: typeof scheduleEventDelivery;
