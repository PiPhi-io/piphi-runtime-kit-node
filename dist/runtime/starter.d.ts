import { ConfigSyncCoordinator } from "./config-sync.js";
import { RuntimeContext } from "./context.js";
import { EventClient } from "./events.js";
import { RuntimeRegistry } from "./registry.js";
import { TelemetryClient } from "./telemetry.js";
import type { RuntimeEntitiesResponse, RuntimeEntity } from "../types.js";
export interface RuntimeStarterOptions {
    integrationId: string;
    integrationName: string;
    version?: string;
    coreBaseUrl?: string;
    maxRecentEvents?: number;
}
/**
 * Beginner-friendly "golden path" runtime bundle.
 *
 * This keeps the most common SDK pieces together so new integration authors
 * can start with one object instead of wiring context, registry, telemetry,
 * events, and config sync separately.
 */
export declare class RuntimeStarter {
    readonly runtime: RuntimeContext;
    readonly registry: RuntimeRegistry<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>;
    readonly telemetryClient: TelemetryClient;
    readonly eventClient: EventClient;
    readonly configSync: ConfigSyncCoordinator;
    readonly integrationId: string;
    readonly integrationName: string;
    readonly version: string;
    constructor(options: RuntimeStarterOptions);
    integrationMetadata(): Record<string, unknown>;
    healthResponse(metadata?: Record<string, unknown>): import("../types.js").RuntimeHealthResponse;
    diagnosticsResponse(diagnostics?: Record<string, unknown>): import("../types.js").RuntimeDiagnosticsResponse;
    entitiesResponse<T extends RuntimeEntity>(entities: T[], options?: {
        capabilities?: Record<string, unknown>;
        commands?: Record<string, unknown>;
    }): RuntimeEntitiesResponse<T>;
}
export declare function buildRuntimeEntitiesResponse<T extends RuntimeEntity>(entities: T[], options?: {
    capabilities?: Record<string, unknown>;
    commands?: Record<string, unknown>;
}): RuntimeEntitiesResponse<T>;
export declare function createRuntimeStarter(options: RuntimeStarterOptions): RuntimeStarter;
