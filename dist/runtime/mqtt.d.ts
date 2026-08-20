export declare const DEFAULT_SOURCE_TOPIC_PREFIX = "piphi/sources";
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
    publishAsync(topic: string, payload: string, options: {
        retain: boolean;
        qos: 0 | 1 | 2;
    }): Promise<unknown>;
    subscribeAsync(topic: string, options: {
        qos: 0 | 1 | 2;
    }): Promise<unknown>;
    endAsync(): Promise<unknown>;
    on(event: "message", listener: (topic: string, payload: Uint8Array | string) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: () => void): this;
    off(event: "message", listener: (topic: string, payload: Uint8Array | string) => void): this;
    off(event: "error", listener: (error: Error) => void): this;
    off(event: "close", listener: () => void): this;
}
export type MqttConnect = (url: string, options: Record<string, unknown>) => Promise<MqttClientLike>;
export declare function sanitizeTopicSegment(value: string): string;
export declare function buildSourceTopicRoot(source: string, prefix?: string): string;
export declare function buildSourcePacketsTopic(source: string, prefix?: string): string;
export declare function buildSourceModelPacketsTopic(source: string, model: string, prefix?: string): string;
export declare function buildSourceStatusTopic(source: string, prefix?: string): string;
export declare function buildSourceErrorsTopic(source: string, prefix?: string): string;
export declare function buildSourcePacketEnvelope(options: {
    source: string;
    packet: Record<string, unknown>;
    receivedAt?: string;
    metadata?: Record<string, unknown>;
}): Record<string, unknown>;
export declare function decodeMqttJsonPayload(payload: Uint8Array | string): Record<string, unknown> | null;
export declare class MqttJsonSession {
    private readonly client;
    private readonly qos;
    constructor(client: MqttClientLike, qos: 0 | 1 | 2);
    publishJson(topic: string, payload: Record<string, unknown>, options?: {
        retain?: boolean;
        qos?: 0 | 1 | 2;
    }): Promise<void>;
    consumeJson(options: {
        topics: Iterable<string>;
        handler: (topic: string, payload: Record<string, unknown>) => Promise<void>;
        signal?: AbortSignal;
    }): Promise<void>;
    close(): Promise<void>;
}
export declare class MqttJsonClient {
    readonly config: MqttBrokerConfig;
    private readonly connect?;
    constructor(config: MqttBrokerConfig, connect?: MqttConnect | undefined);
    withSession<T>(callback: (session: MqttJsonSession) => Promise<T>): Promise<T>;
    runSubscriptionForever(options: {
        topics: Iterable<string>;
        handler: (topic: string, payload: Record<string, unknown>) => Promise<void>;
        retryDelayMs?: number;
        signal?: AbortSignal;
    }): Promise<void>;
}
