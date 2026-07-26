import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
import { RuntimeDeviceRef } from "./identity.js";
export type TelemetryValue = boolean | number | string;
export interface TelemetryReading {
    metric: string;
    value: TelemetryValue;
    unit?: string | null;
}
export declare function buildTelemetryMaps(readings: Iterable<TelemetryReading>): {
    metrics: Record<string, TelemetryValue>;
    units: Record<string, string>;
};
export interface TelemetryClientOptions {
    processState: RuntimeProcessState;
    coreBaseUrl?: string;
    timeoutMs?: number;
}
/**
 * Build outbound auth headers for Core-bound telemetry and event requests.
 */
export declare function buildCoreAuthHeaders(authContext: RuntimeAuthContext): Record<string, string>;
/**
 * Thin client for delivering telemetry back to PiPhi Core.
 */
export declare class TelemetryClient {
    private readonly processState;
    private readonly coreBaseUrl;
    private readonly timeoutMs;
    private readonly telemetryPath;
    constructor(options: TelemetryClientOptions);
    /**
     * Send one telemetry payload to PiPhi Core.
     */
    sendMetrics(options: {
        authContext: RuntimeAuthContext;
        deviceId: string;
        configId?: string | null;
        metrics: Record<string, TelemetryValue>;
        units?: Record<string, string>;
        timestamp?: string;
        containerId?: string | null;
        integrationId?: string | null;
    }): Promise<void>;
    sendDeviceReadings(options: {
        authContext: RuntimeAuthContext;
        device: RuntimeDeviceRef | (Record<string, unknown> & {
            id?: string;
        });
        readings: Iterable<TelemetryReading>;
        timestamp?: string;
    }): Promise<void>;
}
