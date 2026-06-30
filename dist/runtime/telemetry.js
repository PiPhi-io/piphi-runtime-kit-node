import { buildRuntimeAuthHeaders } from "./auth.js";
import { classifyCoreDeliveryError } from "./errors.js";
function normalizeCoreBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "").replace(/\/api\/v2$/, "");
}
/**
 * Build outbound auth headers for Core-bound telemetry and event requests.
 */
export function buildCoreAuthHeaders(authContext) {
    return buildRuntimeAuthHeaders(authContext.resolve());
}
/**
 * Thin client for delivering telemetry back to PiPhi Core.
 */
export class TelemetryClient {
    processState;
    coreBaseUrl;
    timeoutMs;
    telemetryPath;
    constructor(options) {
        this.processState = options.processState;
        this.coreBaseUrl = normalizeCoreBaseUrl(options.coreBaseUrl ?? options.processState.coreBaseUrl);
        this.timeoutMs = options.timeoutMs ?? 4000;
        this.telemetryPath = "/api/v2/integrations/telemetry";
    }
    /**
     * Send one telemetry payload to PiPhi Core.
     */
    async sendMetrics(options) {
        const coreFetch = this.processState.coreFetch ?? fetch;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const telemetryUrl = `${this.coreBaseUrl}${this.telemetryPath}`;
        const payload = {
            deviceId: options.deviceId,
            ...(options.configId !== undefined ? { configId: options.configId } : {}),
            metrics: options.metrics,
            ...(options.units ? { units: options.units } : {}),
            ...(options.containerId !== undefined || options.authContext.containerId !== null
                ? { containerId: options.containerId ?? options.authContext.containerId }
                : {}),
            ...(options.integrationId !== undefined ? { integrationId: options.integrationId } : {}),
        };
        try {
            const response = await coreFetch(telemetryUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...buildCoreAuthHeaders(options.authContext),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            if (!response.ok) {
                throw classifyCoreDeliveryError({
                    error: null,
                    operation: "telemetry_delivery",
                    url: telemetryUrl,
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
                operation: "telemetry_delivery",
                url: telemetryUrl,
                timeoutMs: this.timeoutMs,
            });
        }
        finally {
            clearTimeout(timer);
        }
    }
}
