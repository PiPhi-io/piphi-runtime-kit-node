import { ConfigSyncCoordinator } from "./config-sync.js";
import { RuntimeContext } from "./context.js";
import { EventClient } from "./events.js";
import { buildRuntimeDiagnosticsResponse, buildRuntimeHealthResponse } from "./health.js";
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
export class RuntimeStarter {
  readonly runtime = new RuntimeContext();
  readonly registry: RuntimeRegistry<
    Record<string, unknown>,
    Record<string, unknown>,
    Record<string, unknown>
  >;
  readonly telemetryClient: TelemetryClient;
  readonly eventClient: EventClient;
  readonly configSync: ConfigSyncCoordinator;
  readonly integrationId: string;
  readonly integrationName: string;
  readonly version: string;

  constructor(options: RuntimeStarterOptions) {
    this.integrationId = options.integrationId;
    this.integrationName = options.integrationName;
    this.version = options.version ?? "0.1.0";
    this.registry = new RuntimeRegistry(options.maxRecentEvents ?? 100);

    if (options.coreBaseUrl) {
      this.runtime.processState.coreBaseUrl = options.coreBaseUrl;
    }

    this.telemetryClient = new TelemetryClient(
      options.coreBaseUrl !== undefined
        ? {
            processState: this.runtime.processState,
            coreBaseUrl: options.coreBaseUrl,
          }
        : {
            processState: this.runtime.processState,
          },
    );
    this.eventClient = new EventClient(
      options.coreBaseUrl !== undefined
        ? {
            processState: this.runtime.processState,
            coreBaseUrl: options.coreBaseUrl,
          }
        : {
            processState: this.runtime.processState,
          },
    );
    this.configSync = new ConfigSyncCoordinator(this.runtime.processState);
  }

  integrationMetadata(): Record<string, unknown> {
    return {
      id: this.integrationId,
      name: this.integrationName,
      version: this.version,
    };
  }

  healthResponse(metadata?: Record<string, unknown>) {
    return buildRuntimeHealthResponse(this.runtime, {
      integration: this.integrationMetadata(),
      metadata: metadata ?? { activeConfigs: this.registry.ids().length },
    });
  }

  diagnosticsResponse(diagnostics?: Record<string, unknown>) {
    return buildRuntimeDiagnosticsResponse(this.runtime, {
      integration: this.integrationMetadata(),
      diagnostics:
        diagnostics ??
        {
          activeConfigIds: this.registry.ids(),
          recentEventCount: this.registry.recentEvents.length,
        },
    });
  }

  entitiesResponse<T extends RuntimeEntity>(
    entities: T[],
    options?: {
      capabilities?: Record<string, unknown>;
      commands?: Record<string, unknown>;
    },
  ): RuntimeEntitiesResponse<T> {
    return buildRuntimeEntitiesResponse(entities, options);
  }
}

export function buildRuntimeEntitiesResponse<T extends RuntimeEntity>(
  entities: T[],
  options?: {
    capabilities?: Record<string, unknown>;
    commands?: Record<string, unknown>;
  },
): RuntimeEntitiesResponse<T> {
  return {
    entities,
    capabilities: options?.capabilities ?? {},
    commands: options?.commands ?? {},
  };
}

export function createRuntimeStarter(options: RuntimeStarterOptions): RuntimeStarter {
  return new RuntimeStarter(options);
}
