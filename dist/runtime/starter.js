import { ConfigSyncCoordinator } from "./config-sync.js";
import { RuntimeContext } from "./context.js";
import { EventClient } from "./events.js";
import { buildRuntimeDiagnosticsResponse, buildRuntimeHealthResponse } from "./health.js";
import { RuntimeRegistry } from "./registry.js";
import { TelemetryClient } from "./telemetry.js";
/**
 * Beginner-friendly "golden path" runtime bundle.
 *
 * This keeps the most common SDK pieces together so new integration authors
 * can start with one object instead of wiring context, registry, telemetry,
 * events, and config sync separately.
 */
export class RuntimeStarter {
    runtime = new RuntimeContext();
    registry;
    telemetryClient;
    eventClient;
    configSync;
    integrationId;
    integrationName;
    version;
    constructor(options) {
        this.integrationId = options.integrationId;
        this.integrationName = options.integrationName;
        this.version = options.version ?? "0.1.0";
        this.registry = new RuntimeRegistry(options.maxRecentEvents ?? 100);
        if (options.coreBaseUrl) {
            this.runtime.processState.coreBaseUrl = options.coreBaseUrl;
        }
        this.telemetryClient = new TelemetryClient(options.coreBaseUrl !== undefined
            ? {
                processState: this.runtime.processState,
                coreBaseUrl: options.coreBaseUrl,
            }
            : {
                processState: this.runtime.processState,
            });
        this.eventClient = new EventClient(options.coreBaseUrl !== undefined
            ? {
                processState: this.runtime.processState,
                coreBaseUrl: options.coreBaseUrl,
            }
            : {
                processState: this.runtime.processState,
            });
        this.configSync = new ConfigSyncCoordinator(this.runtime.processState);
    }
    integrationMetadata() {
        return {
            id: this.integrationId,
            name: this.integrationName,
            version: this.version,
        };
    }
    healthResponse(metadata) {
        return buildRuntimeHealthResponse(this.runtime, {
            integration: this.integrationMetadata(),
            metadata: metadata ?? { activeConfigs: this.registry.ids().length },
        });
    }
    diagnosticsResponse(diagnostics) {
        return buildRuntimeDiagnosticsResponse(this.runtime, {
            integration: this.integrationMetadata(),
            diagnostics: diagnostics ??
                {
                    activeConfigIds: this.registry.ids(),
                    recentEventCount: this.registry.recentEvents.length,
                },
        });
    }
}
export function createRuntimeStarter(options) {
    return new RuntimeStarter(options);
}
