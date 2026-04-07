import {
  ConfigSyncCoordinator,
  RuntimeContext,
  RuntimeRegistry,
  TelemetryClient,
  buildConfigApplyResponse,
  buildConfigRemoveResponse,
  buildDiscoveryResponse,
  buildEventIngestResponse,
  buildEventListResponse,
  buildLocalEventRecord,
  buildRuntimeDiagnosticsResponse,
  buildRuntimeHealthResponse,
  formatConfigApplyLog,
  normalizeDiscoveryInputs,
  scheduleTelemetryDelivery,
  type IntegrationDiscoveryRequest,
  type RuntimeConfig,
  type RuntimeConfigSnapshot,
} from "piphi-runtime-kit-node";
import {
  formatFastifyRuntimeAuthSyncLog,
  syncRuntimeAuthFromFastifyRequest,
} from "piphi-runtime-kit-node/adapters/fastify";

type DemoDeviceState = {
  connected: boolean;
  host: string;
  alias?: string | null;
};

interface DemoDeviceConfig extends RuntimeConfig {
  host: string;
  alias?: string | null;
}

type DemoDeviceEntry = {
  configId: string;
  deviceId: string;
  containerId?: string | null;
  integrationId?: string | null;
  host: string;
  alias?: string | null;
  config: DemoDeviceConfig;
  latestState?: DemoDeviceState;
  lastUpdated?: string;
};

type FastifyRequestLike = {
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  params?: Record<string, string>;
};

type FastifyReplyLike = {
  code(statusCode: number): FastifyReplyLike;
  send(payload: unknown): void;
};

const runtime = new RuntimeContext();
const registry = new RuntimeRegistry<DemoDeviceState, DemoDeviceEntry, Record<string, unknown>>();
const telemetry = new TelemetryClient({ processState: runtime.processState });
const configSync = new ConfigSyncCoordinator(runtime.processState);

function syncRuntimeAuth(request: FastifyRequestLike): void {
  syncRuntimeAuthFromFastifyRequest(runtime, request);
  console.info(formatFastifyRuntimeAuthSyncLog(request));
}

async function applyConfig(config: DemoDeviceConfig): Promise<void> {
  registry.set(config.id, {
    configId: config.id,
    deviceId: config.deviceId ?? config.id,
    containerId: config.containerId,
    integrationId: config.integrationId,
    host: config.host,
    alias: config.alias,
    config,
  });

  registry.updateState(config.id, {
    connected: true,
    host: config.host,
    alias: config.alias,
  });
}

async function removeConfig(configId: string): Promise<boolean> {
  return registry.remove(configId) !== undefined;
}

export function registerMinimalFastifyRuntimeRoutes(app: {
  get(path: string, handler: (request: FastifyRequestLike, reply: FastifyReplyLike) => unknown): void;
  post(path: string, handler: (request: FastifyRequestLike, reply: FastifyReplyLike) => unknown): void;
}) {
  app.get("/health", (_request, reply) => {
    reply.send(
      buildRuntimeHealthResponse(runtime, {
        integration: {
          id: "minimal-fastify-runtime",
          name: "Minimal Fastify Runtime",
          version: "0.1.2",
        },
        metadata: {
          activeConfigs: registry.ids().length,
        },
      }),
    );
  });

  app.get("/diagnostics", (_request, reply) => {
    reply.send(
      buildRuntimeDiagnosticsResponse(runtime, {
        integration: {
          id: "minimal-fastify-runtime",
          name: "Minimal Fastify Runtime",
          version: "0.1.2",
        },
        diagnostics: {
          activeConfigIds: registry.ids(),
          recentEventCount: registry.recentEvents.length,
        },
      }),
    );
  });

  app.post("/discover", (request, reply) => {
    const body = (request.body ?? {}) as IntegrationDiscoveryRequest;
    const inputs = normalizeDiscoveryInputs(body.inputs);

    reply.send(
      buildDiscoveryResponse([
        {
          id: "demo-device",
          host: String(inputs.host ?? "127.0.0.1"),
          alias: "Demo Device",
        },
      ]),
    );
  });

  app.post("/config", async (request, reply) => {
    syncRuntimeAuth(request);

    const payload = request.body as DemoDeviceConfig;
    console.info(formatConfigApplyLog(payload));
    await applyConfig(payload);

    reply.send(
      buildConfigApplyResponse({
        configId: payload.id,
        containerId: payload.containerId,
        metadata: {
          host: payload.host,
          alias: payload.alias ?? null,
        },
      }),
    );
  });

  app.post("/config/sync", async (request, reply) => {
    syncRuntimeAuth(request);

    const snapshot = request.body as RuntimeConfigSnapshot<DemoDeviceConfig>;
    const result = await configSync.applySnapshot(snapshot, {
      activeConfigIds: registry.ids(),
      applyConfig,
      removeConfig,
      getActiveConfigIds: () => registry.ids(),
    });

    reply.send(result);
  });

  app.post("/deconfigure/:configId", async (request, reply) => {
    const configId = request.params?.configId ?? "missing";
    const removed = await removeConfig(configId);
    reply.send(
      buildConfigRemoveResponse({
        configId,
        removed,
      }),
    );
  });

  app.get("/state", (_request, reply) => {
    reply.send({
      entries: Object.fromEntries(registry.entries),
      stateSnapshots: Object.fromEntries(registry.stateSnapshots),
    });
  });

  app.post("/events/example", (_request, reply) => {
    const entry = registry.primaryEntry();
    const event = registry.appendEvent(
      buildLocalEventRecord({
        eventType: "demo.event",
        deviceId: entry?.deviceId ?? "demo-device",
        configId: entry?.configId ?? "demo-device",
        containerId: entry?.containerId ?? runtime.auth.containerId ?? null,
        integrationId: entry?.integrationId ?? "minimal-fastify-runtime",
        source: "minimal-fastify-runtime",
        severity: "info",
        payload: {
          message: "Example local runtime event",
        },
      }),
    );
    reply.send(buildEventIngestResponse(event));
  });

  app.get("/events", (_request, reply) => {
    reply.send(buildEventListResponse(registry.recentEvents));
  });

  app.post("/telemetry/example", (request, reply) => {
    syncRuntimeAuth(request);

    const entry = registry.primaryEntry();
    if (!entry) {
      reply.code(409).send({ ok: false, reason: "no configured devices" });
      return;
    }

    scheduleTelemetryDelivery({
      processState: runtime.processState,
      telemetryClient: telemetry,
      authContext: runtime.auth,
      deviceId: entry.deviceId,
      containerId: entry.containerId,
      metrics: {
        connected: true,
        temperatureC: 21.4,
      },
      units: {
        temperatureC: "C",
      },
    });

    reply.send({ status: "queued" });
  });

  return app;
}
