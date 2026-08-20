export const DEFAULT_SOURCE_TOPIC_PREFIX = "piphi/sources";
export function sanitizeTopicSegment(value) {
    return String(value).trim().replaceAll("/", "_").replaceAll(" ", "_");
}
export function buildSourceTopicRoot(source, prefix = DEFAULT_SOURCE_TOPIC_PREFIX) {
    return `${prefix.replace(/\/+$/, "")}/${sanitizeTopicSegment(source)}`;
}
export function buildSourcePacketsTopic(source, prefix = DEFAULT_SOURCE_TOPIC_PREFIX) {
    return `${buildSourceTopicRoot(source, prefix)}/packets`;
}
export function buildSourceModelPacketsTopic(source, model, prefix = DEFAULT_SOURCE_TOPIC_PREFIX) {
    return `${buildSourceTopicRoot(source, prefix)}/models/${sanitizeTopicSegment(model)}/packets`;
}
export function buildSourceStatusTopic(source, prefix = DEFAULT_SOURCE_TOPIC_PREFIX) {
    return `${buildSourceTopicRoot(source, prefix)}/status`;
}
export function buildSourceErrorsTopic(source, prefix = DEFAULT_SOURCE_TOPIC_PREFIX) {
    return `${buildSourceTopicRoot(source, prefix)}/errors`;
}
function optionalString(value) {
    return value === undefined || value === null || value === "" ? null : String(value);
}
function firstPresent(packet, keys) {
    for (const key of keys) {
        const value = packet[key];
        if (value !== undefined && value !== null && value !== "")
            return value;
    }
    return null;
}
export function buildSourcePacketEnvelope(options) {
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
export function decodeMqttJsonPayload(payload) {
    try {
        const text = typeof payload === "string" ? payload : new TextDecoder().decode(payload);
        const parsed = JSON.parse(text);
        return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : null;
    }
    catch {
        return null;
    }
}
async function loadMqttConnector() {
    try {
        const mqtt = await import("mqtt");
        return mqtt.connectAsync;
    }
    catch (error) {
        throw new Error("mqtt is not installed. Install it alongside piphi-runtime-kit-node with 'npm install mqtt'.", { cause: error });
    }
}
export class MqttJsonSession {
    client;
    qos;
    constructor(client, qos) {
        this.client = client;
        this.qos = qos;
    }
    async publishJson(topic, payload, options = {}) {
        await this.client.publishAsync(topic, JSON.stringify(payload), {
            retain: options.retain ?? false,
            qos: options.qos ?? this.qos,
        });
    }
    async consumeJson(options) {
        for (const topic of options.topics)
            await this.client.subscribeAsync(topic, { qos: this.qos });
        await new Promise((resolve, reject) => {
            let settled = false;
            const cleanup = () => {
                this.client.off("message", onMessage);
                this.client.off("error", onError);
                this.client.off("close", onClose);
                options.signal?.removeEventListener("abort", onAbort);
            };
            const finish = (error) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                if (error)
                    reject(error);
                else
                    resolve();
            };
            const onMessage = (topic, raw) => {
                const payload = decodeMqttJsonPayload(raw);
                if (payload !== null)
                    void options.handler(topic, payload).catch((error) => {
                        finish(error instanceof Error ? error : new Error(String(error)));
                    });
            };
            const onError = (error) => finish(error);
            const onClose = () => finish();
            const onAbort = () => finish();
            this.client.on("message", onMessage);
            this.client.on("error", onError);
            this.client.on("close", onClose);
            options.signal?.addEventListener("abort", onAbort, { once: true });
            if (options.signal?.aborted)
                finish();
        });
    }
    async close() { await this.client.endAsync(); }
}
export class MqttJsonClient {
    config;
    connect;
    constructor(config, connect) {
        this.config = config;
        this.connect = connect;
    }
    async withSession(callback) {
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
        try {
            return await callback(session);
        }
        finally {
            await session.close();
        }
    }
    async runSubscriptionForever(options) {
        const retryDelayMs = options.retryDelayMs ?? 5_000;
        while (!options.signal?.aborted) {
            try {
                await this.withSession((session) => session.consumeJson(options));
            }
            catch (error) {
                if (options.signal?.aborted)
                    return;
                console.warn("mqtt_subscription_failed", error);
            }
            if (!options.signal?.aborted) {
                await new Promise((resolve) => {
                    const timer = setTimeout(resolve, retryDelayMs);
                    options.signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
                });
            }
        }
    }
}
