import express, { type Request, type Response } from "express";
import {
  buildConfigApplyResponse,
  buildConfigRemoveResponse,
  buildDiscoveryResponse,
  buildEventIngestResponse,
  buildEventListResponse,
  buildLocalEventRecord,
  createRuntimeStarter,
  formatConfigApplyLog,
  normalizeDiscoveryInputs,
  scheduleTelemetryDelivery,
  type IntegrationDiscoveryRequest,
  type RuntimeConfig,
  type RuntimeConfigSnapshot,
} from "piphi-runtime-kit-node";
import {
  formatExpressRuntimeAuthSyncLog,
  syncRuntimeAuthFromExpressRequest,
} from "piphi-runtime-kit-node/adapters/express";

const integrationId = "minimal-express-runtime";
const integrationName = "Minimal Express Runtime";
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

const app = express();
app.use(express.json());

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

function syncRuntimeAuth(req: Request): void {
  syncRuntimeAuthFromExpressRequest(runtime, req);
  console.info(formatExpressRuntimeAuthSyncLog(req));
}

function buildEntry(config: DemoDeviceConfig): DemoDeviceEntry {
  return {
    configId: config.configId ?? config.id,
    deviceId: config.deviceId ?? config.id,
    containerId: config.containerId,
    integrationId: config.integrationId ?? integrationId,
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
  });

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

app.get("/health", (_req: Request, res: Response) => {
  res.json(starter.healthResponse({ activeConfigs: registry.ids().length }));
});

app.get("/diagnostics", (_req: Request, res: Response) => {
  res.json(
    starter.diagnosticsResponse({
      activeConfigIds: registry.ids(),
      recentEventCount: registry.recentEvents.length,
      teachingMode: "beginner-and-advanced",
    }),
  );
});

app.post("/discover", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as IntegrationDiscoveryRequest;
  const inputs = normalizeDiscoveryInputs(body.inputs);

  res.json(
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

app.post("/config", async (req: Request, res: Response) => {
  syncRuntimeAuth(req);

  const payload = req.body as DemoDeviceConfig;
  console.info(formatConfigApplyLog(payload));
  await applyConfig(payload);

  res.json(
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

app.post("/config/sync", async (req: Request, res: Response) => {
  syncRuntimeAuth(req);

  const snapshot = req.body as RuntimeConfigSnapshot<DemoDeviceConfig>;
  const result = await configSync.applySnapshot(snapshot, {
    activeConfigIds: registry.ids(),
    applyConfig,
    removeConfig,
    getActiveConfigIds: () => registry.ids(),
  });

  res.json(result);
});

app.post("/deconfigure/:configId", async (req: Request, res: Response) => {
  const removed = await removeConfig(req.params.configId);
  res.json(
    buildConfigRemoveResponse({
      configId: req.params.configId,
      removed,
    }),
  );
});

app.get("/state", (_req: Request, res: Response) => {
  res.json({
    summary: {
      activeConfigCount: registry.ids().length,
      recentEventCount: registry.recentEvents.length,
    },
    entries: Object.fromEntries(registry.entries),
    stateSnapshots: Object.fromEntries(registry.stateSnapshots),
  });
});

app.post("/events/example", (_req: Request, res: Response) => {
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
  res.json(buildEventIngestResponse(event));
});

app.post("/events/device/:configId/example", (req: Request, res: Response) => {
  const entry = registry.get(req.params.configId);
  if (!entry) {
    res.status(404).json({ ok: false, reason: `unknown configId=${req.params.configId}` });
    return;
  }

  const event = appendRuntimeEvent("demo.device.checked", entry, {
    message: "Advanced example event for a specific configured device",
    host: entry.host,
  });
  res.json(buildEventIngestResponse(event));
});

app.get("/events", (_req: Request, res: Response) => {
  res.json(buildEventListResponse(registry.recentEvents));
});

app.post("/telemetry/example", (req: Request, res: Response) => {
  syncRuntimeAuth(req);

  const entry = registry.primaryEntry();
  if (!entry) {
    res.status(409).json({ ok: false, reason: "no configured devices" });
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

  res.json({ status: "queued" });
});

app.post("/telemetry/device/:configId/example", (req: Request, res: Response) => {
  syncRuntimeAuth(req);

  const entry = registry.get(req.params.configId);
  if (!entry) {
    res.status(404).json({ ok: false, reason: `unknown configId=${req.params.configId}` });
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

  res.json({ status: "queued" });
});

export default app;
