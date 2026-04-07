import { RuntimeAuthContext } from "./auth.js";
import { RuntimeProcessState } from "./state.js";
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
        metrics: Record<string, unknown>;
        units?: Record<string, string>;
        containerId?: string | null;
        integrationId?: string | null;
    }): Promise<void>;
}
