import type { RuntimeAuthContext } from "./runtime/auth.js";
import { type EventClient } from "./runtime/events.js";
import { RuntimeDeviceRef } from "./runtime/identity.js";
export interface AutomationActionRequest {
    command: string;
    args: Record<string, unknown>;
    idempotencyKey?: string | null;
    commandId?: string | null;
    correlationId?: string | null;
    integrationId?: string | null;
    configId?: string | null;
    containerId?: string | null;
    deviceId?: string | null;
    entityId?: string | null;
    capabilityId?: string | null;
    runId?: string | null;
    nodeId?: string | null;
    [key: string]: unknown;
}
export type AutomationActionStatus = "success" | "failed";
export declare class AutomationActionResult {
    readonly status: AutomationActionStatus;
    readonly result: Record<string, unknown>;
    readonly error: string | null;
    readonly retryable: boolean;
    readonly metadata: Record<string, unknown>;
    readonly replayed: boolean;
    constructor(values: {
        status: AutomationActionStatus;
        result?: Record<string, unknown>;
        error?: string | null;
        retryable?: boolean;
        metadata?: Record<string, unknown>;
        replayed?: boolean;
    });
    get ok(): boolean;
    static success(result?: Record<string, unknown>): AutomationActionResult;
    static failure(error: string, options?: {
        retryable?: boolean;
        metadata?: Record<string, unknown>;
    }): AutomationActionResult;
    withReplay(): AutomationActionResult;
    toJSON(): Record<string, unknown>;
    static from(value: unknown): AutomationActionResult;
}
export interface AutomationIdempotencyStore {
    get(key: string): Promise<AutomationActionResult | null>;
    put(key: string, result: AutomationActionResult): Promise<void>;
}
export interface AutomationIdempotencyClaimStore extends AutomationIdempotencyStore {
    claim(key: string): Promise<boolean>;
    release(key: string): Promise<void>;
}
export declare class InMemoryAutomationIdempotencyStore implements AutomationIdempotencyStore {
    private readonly results;
    get(key: string): Promise<AutomationActionResult | null>;
    put(key: string, result: AutomationActionResult): Promise<void>;
}
/**
 * Durable, dependency-free action claim ledger for Node sidecars.
 *
 * Exclusive file creation claims an action across local processes. A process
 * crash leaves a dispatching record, which is deliberately reported as
 * ambiguous instead of risking a duplicate device effect.
 */
export declare class FileAutomationIdempotencyStore implements AutomationIdempotencyClaimStore {
    readonly directory: string;
    constructor(directory: string);
    private recordPath;
    claim(key: string): Promise<boolean>;
    get(key: string): Promise<AutomationActionResult | null>;
    put(key: string, result: AutomationActionResult): Promise<void>;
    release(key: string): Promise<void>;
}
export interface AutomationActionDefinition {
    command: string;
    label: string;
    parameterSchema: Record<string, unknown>;
    resultSchema: Record<string, unknown>;
}
export interface AutomationEventDefinition {
    eventType: string;
    label: string;
    dataSchema: Record<string, unknown>;
}
export interface AutomationContractReport {
    ok: boolean;
    missingActionHandlers: string[];
    missingEventPublishers: string[];
    undeclaredActionHandlers: string[];
    undeclaredEventPublishers: string[];
    messages: string[];
}
export type AutomationHandlerValue = AutomationActionResult | Record<string, unknown> | void;
export type AutomationActionHandler = (request: AutomationActionRequest) => AutomationHandlerValue | Promise<AutomationHandlerValue>;
export declare class AutomationRegistry {
    readonly idempotencyStore: AutomationIdempotencyStore | undefined;
    private readonly actions;
    private readonly events;
    private readonly keyQueues;
    constructor(options?: {
        idempotencyStore?: AutomationIdempotencyStore;
    });
    get actionDefinitions(): AutomationActionDefinition[];
    get eventDefinitions(): AutomationEventDefinition[];
    action(command: string, options?: {
        label?: string;
        parameterSchema?: Record<string, unknown>;
        resultSchema?: Record<string, unknown>;
    }): (handler: AutomationActionHandler) => AutomationActionHandler;
    event(eventType: string, options?: {
        label?: string;
        dataSchema?: Record<string, unknown>;
    }): AutomationEventDefinition;
    dispatch(requestValue: AutomationActionRequest | Record<string, unknown>, options?: {
        idempotencyKey?: string | null;
    }): Promise<AutomationActionResult>;
    contractSnapshot(): Record<string, unknown>;
    private invoke;
    private withKeyLock;
}
export declare class AutomationClient {
    readonly options: {
        eventClient: EventClient;
        authContext: RuntimeAuthContext;
        registry?: AutomationRegistry;
    };
    constructor(options: {
        eventClient: EventClient;
        authContext: RuntimeAuthContext;
        registry?: AutomationRegistry;
    });
    emit(values: {
        eventType: string;
        device: RuntimeDeviceRef | (Record<string, unknown> & {
            id?: string;
        });
        data?: Record<string, unknown>;
        source?: string;
        severity?: "info" | "warning" | "error" | "critical";
        eventId?: string;
    }): Promise<void>;
}
export declare function buildMockAutomationEvent(values: {
    eventType: string;
    data?: Record<string, unknown>;
    integrationId?: string;
    configId?: string;
    containerId?: string;
    deviceId?: string;
    eventId?: string;
}): import("./types.js").CoreEventPayload;
export declare function auditBehaviorsContract(behaviors: Record<string, unknown>, registry: AutomationRegistry): AutomationContractReport;
export declare function assertBehaviorsContract(behaviors: Record<string, unknown>, registry: AutomationRegistry): void;
export declare function normalizeAutomationActionRequest(value: AutomationActionRequest | Record<string, unknown>, idempotencyKey?: string | null): AutomationActionRequest;
