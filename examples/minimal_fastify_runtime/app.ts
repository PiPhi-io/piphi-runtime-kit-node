import {
  buildConfigApplyResponse,
  buildConfigRemoveResponse,
  buildDiscoveryResponse,
  buildEventIngestResponse,
  buildEventListResponse,
  buildLocalEventRecord,
  buildRuntimeIdentity,
  createRuntimeStarter,
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

const integrationId = "minimal-fastify-runtime";
const integrationName = "Minimal Fastify Runtime";
const integrationVersion = "0.1.2";

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

const starter = createRuntimeStarter({
  integrationId,
  integrationName,
  version: integrationVersion,
});
const runtime = starter.runtime;
const registry = starter.registry as typeof starter.registry & {
  set(entryId: string, entry: DemoDeviceEntry): DemoDeviceEntry;
  get(entryId: string): DemoDeviceEntry | undefined;
  primaryEntry(): DemoDeviceEntry | undefined;
  updateState(entryId: string, state: DemoDeviceState): {
    deviceId: string;
    state: DemoDeviceState;
    lastUpdated: string;
  };
};
const telemetry = starter.telemetryClient;
const configSync = starter.configSync;

function syncRuntimeAuth(request: FastifyRequestLike): void {
  syncRuntimeAuthFromFastifyRequest(runtime, request);
  console.info(formatFastifyRuntimeAuthSyncLog(request));
}

function buildEntry(config: DemoDeviceConfig): DemoDeviceEntry {
  const identity = buildRuntimeIdentity(config, { integrationId });
  return {
    ...identity,
    host: config.host,
    alias: config.alias,
    config,
  };
}

function appendRuntimeEvent(
  eventType: string,
  entry: Partial<DemoDeviceEntry> & { deviceId: string; configId: string },
  payload: Record<string, unknown>,
) {
  return registry.appendEvent(
    buildLocalEventRecord({
      eventType,
      deviceId: entry.deviceId,
      configId: entry.configId,
      containerId: entry.containerId ?? runtime.auth.containerId ?? null,
      integrationId: entry.integrationId ?? integrationId,
      source: integrationId,
      severity: "info",
      payload,
    }),
  );
}

async function applyConfig(config: DemoDeviceConfig): Promise<void> {
  const entry = buildEntry(config);
  registry.set(config.id, entry);
  registry.updateState(config.id, {
    connected: true,
    host: config.host,
    alias: config.alias,
  }, entry.deviceId);

  appendRuntimeEvent("demo.config.applied", entry, {
    host: config.host,
    alias: config.alias ?? null,
  });
}

async function removeConfig(configId: string): Promise<boolean> {
  const removedEntry = registry.remove(configId);
  if (!removedEntry) {
    return false;
  }

  appendRuntimeEvent("demo.config.removed", removedEntry, {
    host: removedEntry.host,
    alias: removedEntry.alias ?? null,
  });
  return true;
}

export function registerMinimalFastifyRuntimeRoutes(app: {
  get(path: string, handler: (request: FastifyRequestLike, reply: FastifyReplyLike) => unknown): void;
  post(path: string, handler: (request: FastifyRequestLike, reply: FastifyReplyLike) => unknown): void;
}) {
  app.get("/health", (_request, reply) => {
    reply.send(starter.healthResponse({ activeConfigs: registry.ids().length }));
  });

  app.get("/diagnostics", (_request, reply) => {
    reply.send(
      starter.diagnosticsResponse({
        activeConfigIds: registry.ids(),
        recentEventCount: registry.recentEvents.length,
        teachingMode: "beginner-and-advanced",
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
          deviceId: "demo-device",
          host: String(inputs.host ?? "127.0.0.1"),
          alias: "Demo Device",
          supportsTargetedExamples: true,
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
        configId: payload.configId ?? payload.id,
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
      summary: {
        activeConfigCount: registry.ids().length,
        recentEventCount: registry.recentEvents.length,
      },
      entries: Object.fromEntries(registry.entries),
      stateSnapshots: Object.fromEntries(registry.stateSnapshots),
    });
  });

  app.post("/events/example", (_request, reply) => {
    const entry = registry.primaryEntry();
    const event = appendRuntimeEvent(
      "demo.event",
      {
        deviceId: entry?.deviceId ?? "demo-device",
        configId: entry?.configId ?? "demo-device",
        containerId: entry?.containerId ?? runtime.auth.containerId ?? null,
        integrationId: entry?.integrationId ?? integrationId,
      },
      {
        message: "Example local runtime event",
      },
    );
    reply.send(buildEventIngestResponse(event));
  });

  app.post("/events/device/:configId/example", (request, reply) => {
    const configId = request.params?.configId ?? "missing";
    const entry = registry.get(configId);
    if (!entry) {
      reply.code(404).send({ ok: false, reason: `unknown configId=${configId}` });
      return;
    }

    const event = appendRuntimeEvent("demo.device.checked", entry, {
      message: "Advanced example event for a specific configured device",
      host: entry.host,
    });
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

  app.post("/telemetry/device/:configId/example", (request, reply) => {
    syncRuntimeAuth(request);

    const configId = request.params?.configId ?? "missing";
    const entry = registry.get(configId);
    if (!entry) {
      reply.code(404).send({ ok: false, reason: `unknown configId=${configId}` });
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
        humidityPercent: 46.0,
      },
      units: {
        temperatureC: "C",
        humidityPercent: "%",
      },
    });

    reply.send({ status: "queued" });
  });

  return app;
}
