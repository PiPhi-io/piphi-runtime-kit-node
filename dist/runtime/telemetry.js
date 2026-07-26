import { buildRuntimeAuthHeaders } from "./auth.js";
import { classifyCoreDeliveryError } from "./errors.js";
import { RuntimeDeviceRef } from "./identity.js";
export function buildTelemetryMaps(readings) {
    const metrics = {};
    const units = {};
    for (const reading of readings) {
        const metric = String(reading.metric ?? "").trim();
        if (!metric)
            throw new TypeError("TelemetryReading.metric cannot be empty");
        if (Object.hasOwn(metrics, metric)) {
            throw new TypeError(`Duplicate telemetry metric: ${metric}`);
        }
        if (!["boolean", "number", "string"].includes(typeof reading.value)) {
            throw new TypeError("TelemetryReading.value must be boolean, number, or string");
        }
        metrics[metric] = reading.value;
        if (reading.unit)
            units[metric] = reading.unit;
    }
    if (Object.keys(metrics).length === 0) {
        throw new TypeError("At least one TelemetryReading is required");
    }
    return { metrics, units };
}
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
            timestamp: options.timestamp ?? new Date().toISOString(),
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
    async sendDeviceReadings(options) {
        const device = options.device instanceof RuntimeDeviceRef
            ? options.device
            : RuntimeDeviceRef.fromValue(options.device, {
                containerId: options.authContext.containerId,
            });
        const { metrics, units } = buildTelemetryMaps(options.readings);
        await this.sendMetrics({
            authContext: options.authContext,
            deviceId: device.deviceId,
            configId: device.configId,
            containerId: device.containerId,
            metrics,
            ...(Object.keys(units).length > 0 ? { units } : {}),
            ...(options.timestamp ? { timestamp: options.timestamp } : {}),
        });
    }
}
