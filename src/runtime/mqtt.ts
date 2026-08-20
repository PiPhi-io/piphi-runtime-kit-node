export const DEFAULT_SOURCE_TOPIC_PREFIX = "piphi/sources";

export interface MqttBrokerConfig {
  hostname: string;
  port?: number;
  username?: string;
  password?: string;
  clientId?: string;
  keepalive?: number;
  protocol?: "mqtt" | "mqtts" | "ws" | "wss";
  qos?: 0 | 1 | 2;
}

export interface MqttClientLike {
  publishAsync(topic: string, payload: string, options: { retain: boolean; qos: 0 | 1 | 2 }): Promise<unknown>;
  subscribeAsync(topic: string, options: { qos: 0 | 1 | 2 }): Promise<unknown>;
  endAsync(): Promise<unknown>;
  on(event: "message", listener: (topic: string, payload: Uint8Array | string) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
  on(event: "close", listener: () => void): this;
  off(event: "message", listener: (topic: string, payload: Uint8Array | string) => void): this;
  off(event: "error", listener: (error: Error) => void): this;
  off(event: "close", listener: () => void): this;
}

export type MqttConnect = (url: string, options: Record<string, unknown>) => Promise<MqttClientLike>;

export function sanitizeTopicSegment(value: string): string {
  return String(value).trim().replaceAll("/", "_").replaceAll(" ", "_");
}

export function buildSourceTopicRoot(source: string, prefix = DEFAULT_SOURCE_TOPIC_PREFIX): string {
  return `${prefix.replace(/\/+$/, "")}/${sanitizeTopicSegment(source)}`;
}

export function buildSourcePacketsTopic(source: string, prefix = DEFAULT_SOURCE_TOPIC_PREFIX): string {
  return `${buildSourceTopicRoot(source, prefix)}/packets`;
}

export function buildSourceModelPacketsTopic(
  source: string,
  model: string,
  prefix = DEFAULT_SOURCE_TOPIC_PREFIX,
): string {
  return `${buildSourceTopicRoot(source, prefix)}/models/${sanitizeTopicSegment(model)}/packets`;
}

export function buildSourceStatusTopic(source: string, prefix = DEFAULT_SOURCE_TOPIC_PREFIX): string {
  return `${buildSourceTopicRoot(source, prefix)}/status`;
}

export function buildSourceErrorsTopic(source: string, prefix = DEFAULT_SOURCE_TOPIC_PREFIX): string {
  return `${buildSourceTopicRoot(source, prefix)}/errors`;
}

function optionalString(value: unknown): string | null {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function firstPresent(packet: Record<string, unknown>, keys: readonly string[]): unknown {
  for (const key of keys) {
    const value = packet[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

export function buildSourcePacketEnvelope(options: {
  source: string;
  packet: Record<string, unknown>;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
}): Record<string, unknown> {
  const model = optionalString(options.packet.model);
  return {
    source: options.source,
    received_at: options.receivedAt ?? new Date().toISOString(),
    model,
    device_hint: {
      model,
      id: optionalString(firstPresent(options.packet, ["id", "device_id", "device", "sid", "unit"])),
      channel: optionalString(firstPresent(options.packet, ["channel", "subtype"])),
    },
    packet: { ...options.packet },
    metadata: { ...(options.metadata ?? {}) },
  };
}

export function decodeMqttJsonPayload(payload: Uint8Array | string): Record<string, unknown> | null {
  try {
    const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
    const parsed: unknown = JSON.parse(text);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function loadMqttConnector(): Promise<MqttConnect> {
  try {
    const mqtt = await import("mqtt");
    return mqtt.connectAsync as MqttConnect;
  } catch (error) {
    throw new Error(
      "mqtt is not installed. Install it alongside piphi-runtime-kit-node with 'npm install mqtt'.",
      { cause: error },
    );
  }
}

export class MqttJsonSession {
  constructor(private readonly client: MqttClientLike, private readonly qos: 0 | 1 | 2) {}

  async publishJson(
    topic: string,
    payload: Record<string, unknown>,
    options: { retain?: boolean; qos?: 0 | 1 | 2 } = {},
  ): Promise<void> {
    await this.client.publishAsync(topic, JSON.stringify(payload), {
      retain: options.retain ?? false,
      qos: options.qos ?? this.qos,
    });
  }

  async consumeJson(options: {
    topics: Iterable<string>;
    handler: (topic: string, payload: Record<string, unknown>) => Promise<void>;
    signal?: AbortSignal;
  }): Promise<void> {
    for (const topic of options.topics) await this.client.subscribeAsync(topic, { qos: this.qos });
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const cleanup = (): void => {
        this.client.off("message", onMessage);
        this.client.off("error", onError);
        this.client.off("close", onClose);
        options.signal?.removeEventListener("abort", onAbort);
      };
      const finish = (error?: Error): void => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error); else resolve();
      };
      const onMessage = (topic: string, raw: Uint8Array | string): void => {
        const payload = decodeMqttJsonPayload(raw);
        if (payload !== null) void options.handler(topic, payload).catch((error: unknown) => {
          finish(error instanceof Error ? error : new Error(String(error)));
        });
      };
      const onError = (error: Error): void => finish(error);
      const onClose = (): void => finish();
      const onAbort = (): void => finish();
      this.client.on("message", onMessage);
      this.client.on("error", onError);
      this.client.on("close", onClose);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) finish();
    });
  }

  async close(): Promise<void> { await this.client.endAsync(); }
}

export class MqttJsonClient {
  constructor(readonly config: MqttBrokerConfig, private readonly connect?: MqttConnect) {}

  async withSession<T>(callback: (session: MqttJsonSession) => Promise<T>): Promise<T> {
    const protocol = this.config.protocol ?? "mqtt";
    const port = this.config.port ?? (protocol === "mqtts" || protocol === "wss" ? 8883 : 1883);
    const connect = this.connect ?? await loadMqttConnector();
    const client = await connect(`${protocol}://${this.config.hostname}:${port}`, {
      username: this.config.username,
      password: this.config.password,
      clientId: this.config.clientId,
      keepalive: this.config.keepalive ?? 60,
    });
    const session = new MqttJsonSession(client, this.config.qos ?? 0);
    try { return await callback(session); }
    finally { await session.close(); }
  }

  async runSubscriptionForever(options: {
    topics: Iterable<string>;
    handler: (topic: string, payload: Record<string, unknown>) => Promise<void>;
    retryDelayMs?: number;
    signal?: AbortSignal;
  }): Promise<void> {
    const retryDelayMs = options.retryDelayMs ?? 5_000;
    while (!options.signal?.aborted) {
      try {
        await this.withSession((session) => session.consumeJson(options));
      } catch (error) {
        if (options.signal?.aborted) return;
        console.warn("mqtt_subscription_failed", error);
      }
      if (!options.signal?.aborted) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, retryDelayMs);
          options.signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      }
    }
  }
}
