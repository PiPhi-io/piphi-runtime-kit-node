import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { RuntimeAuthContext } from "./runtime/auth.js";
import { buildCoreEventPayload, type EventClient } from "./runtime/events.js";
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

export class AutomationActionResult {
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
  }) {
    this.status = values.status;
    this.result = { ...(values.result ?? {}) };
    this.error = values.error ?? null;
    this.retryable = values.retryable ?? false;
    this.metadata = { ...(values.metadata ?? {}) };
    this.replayed = values.replayed ?? false;
  }

  get ok(): boolean {
    return this.status === "success";
  }

  static success(result: Record<string, unknown> = {}): AutomationActionResult {
    return new AutomationActionResult({ status: "success", result });
  }

  static failure(
    error: string,
    options: { retryable?: boolean; metadata?: Record<string, unknown> } = {},
  ): AutomationActionResult {
    return new AutomationActionResult({
      status: "failed",
      error,
      ...(options.retryable !== undefined ? { retryable: options.retryable } : {}),
      ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    });
  }

  withReplay(): AutomationActionResult {
    return new AutomationActionResult({
      status: this.status,
      result: this.result,
      error: this.error,
      retryable: this.retryable,
      metadata: this.metadata,
      replayed: true,
    });
  }

  toJSON(): Record<string, unknown> {
    return {
      status: this.status,
      result: this.result,
      error: this.error,
      retryable: this.retryable,
      metadata: this.metadata,
      replayed: this.replayed,
    };
  }

  static from(value: unknown): AutomationActionResult {
    if (value instanceof AutomationActionResult) return value;
    if (!isRecord(value) || (value.status !== "success" && value.status !== "failed")) {
      throw new TypeError("Invalid automation action result");
    }
    return new AutomationActionResult({
      status: value.status,
      result: isRecord(value.result) ? value.result : {},
      error: typeof value.error === "string" ? value.error : null,
      retryable: value.retryable === true,
      metadata: isRecord(value.metadata) ? value.metadata : {},
      replayed: value.replayed === true,
    });
  }
}

export interface AutomationIdempotencyStore {
  get(key: string): Promise<AutomationActionResult | null>;
  put(key: string, result: AutomationActionResult): Promise<void>;
}

export interface AutomationIdempotencyClaimStore extends AutomationIdempotencyStore {
  claim(key: string): Promise<boolean>;
  release(key: string): Promise<void>;
}

export class InMemoryAutomationIdempotencyStore implements AutomationIdempotencyStore {
  private readonly results = new Map<string, AutomationActionResult>();

  async get(key: string): Promise<AutomationActionResult | null> {
    const result = this.results.get(key);
    return result ? AutomationActionResult.from(result.toJSON()) : null;
  }

  async put(key: string, result: AutomationActionResult): Promise<void> {
    this.results.set(key, AutomationActionResult.from(result.toJSON()));
  }
}

/**
 * Durable, dependency-free action claim ledger for Node sidecars.
 *
 * Exclusive file creation claims an action across local processes. A process
 * crash leaves a dispatching record, which is deliberately reported as
 * ambiguous instead of risking a duplicate device effect.
 */
export class FileAutomationIdempotencyStore implements AutomationIdempotencyClaimStore {
  readonly directory: string;

  constructor(directory: string) {
    this.directory = path.resolve(directory);
  }

  private recordPath(key: string): string {
    const digest = createHash("sha256").update(key).digest("hex");
    return path.join(this.directory, `${digest}.json`);
  }

  async claim(key: string): Promise<boolean> {
    await mkdir(this.directory, { recursive: true });
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(this.recordPath(key), "wx", 0o600);
      await handle.writeFile(JSON.stringify({ status: "dispatching", updatedAt: new Date().toISOString() }));
      return true;
    } catch (error) {
      if (isNodeError(error) && error.code === "EEXIST") return false;
      throw error;
    } finally {
      await handle?.close();
    }
  }

  async get(key: string): Promise<AutomationActionResult | null> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(this.recordPath(key), "utf8"));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return null;
      throw error;
    }
    if (!isRecord(parsed)) return null;
    if (parsed.status === "dispatching") {
      return AutomationActionResult.failure(
        "An earlier action attempt may still have reached the device; manual review is required",
        { retryable: false, metadata: { deliveryStatus: "ambiguous" } },
      );
    }
    return parsed.status === "terminal" ? AutomationActionResult.from(parsed.result) : null;
  }

  async put(key: string, result: AutomationActionResult): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    const recordPath = this.recordPath(key);
    const temporaryPath = `${recordPath}.${randomUUID()}.tmp`;
    await writeFile(
      temporaryPath,
      JSON.stringify({ status: "terminal", result: result.toJSON(), updatedAt: new Date().toISOString() }),
      { mode: 0o600 },
    );
    await rename(temporaryPath, recordPath);
  }

  async release(key: string): Promise<void> {
    const recordPath = this.recordPath(key);
    try {
      const parsed = JSON.parse(await readFile(recordPath, "utf8")) as unknown;
      if (isRecord(parsed) && parsed.status === "dispatching") {
        await rm(recordPath, { force: true });
      }
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return;
      throw error;
    }
  }
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
export type AutomationActionHandler = (
  request: AutomationActionRequest,
) => AutomationHandlerValue | Promise<AutomationHandlerValue>;

interface KeyQueue {
  tail: Promise<void>;
  pending: number;
}

export class AutomationRegistry {
  readonly idempotencyStore: AutomationIdempotencyStore | undefined;
  private readonly actions = new Map<string, { definition: AutomationActionDefinition; handler: AutomationActionHandler }>();
  private readonly events = new Map<string, AutomationEventDefinition>();
  private readonly keyQueues = new Map<string, KeyQueue>();

  constructor(options: { idempotencyStore?: AutomationIdempotencyStore } = {}) {
    this.idempotencyStore = options.idempotencyStore;
  }

  get actionDefinitions(): AutomationActionDefinition[] {
    return [...this.actions.values()].map(({ definition }) => ({ ...definition }));
  }

  get eventDefinitions(): AutomationEventDefinition[] {
    return [...this.events.values()].map((definition) => ({ ...definition }));
  }

  action(
    command: string,
    options: {
      label?: string;
      parameterSchema?: Record<string, unknown>;
      resultSchema?: Record<string, unknown>;
    } = {},
  ): (handler: AutomationActionHandler) => AutomationActionHandler {
    const normalized = command.trim();
    if (!normalized) throw new TypeError("Automation action command cannot be empty");
    return (handler) => {
      if (this.actions.has(normalized)) {
        throw new TypeError(`Automation action '${normalized}' is already registered`);
      }
      this.actions.set(normalized, {
        definition: {
          command: normalized,
          label: options.label?.trim() || normalized,
          parameterSchema: { ...(options.parameterSchema ?? {}) },
          resultSchema: { ...(options.resultSchema ?? {}) },
        },
        handler,
      });
      return handler;
    };
  }

  event(
    eventType: string,
    options: { label?: string; dataSchema?: Record<string, unknown> } = {},
  ): AutomationEventDefinition {
    const normalized = eventType.trim();
    if (!normalized) throw new TypeError("Automation event type cannot be empty");
    if (this.events.has(normalized)) {
      throw new TypeError(`Automation event '${normalized}' is already registered`);
    }
    const definition = {
      eventType: normalized,
      label: options.label?.trim() || normalized,
      dataSchema: { ...(options.dataSchema ?? {}) },
    };
    this.events.set(normalized, definition);
    return { ...definition };
  }

  async dispatch(
    requestValue: AutomationActionRequest | Record<string, unknown>,
    options: { idempotencyKey?: string | null } = {},
  ): Promise<AutomationActionResult> {
    const request = normalizeAutomationActionRequest(requestValue, options.idempotencyKey);
    const registered = this.actions.get(request.command);
    if (!registered) {
      return AutomationActionResult.failure(`Unknown automation action '${request.command}'`);
    }
    const scopedKey = request.idempotencyKey ? `${request.command}:${request.idempotencyKey}` : "";
    if (!scopedKey || !this.idempotencyStore) return this.invoke(registered.handler, request);
    return this.withKeyLock(scopedKey, async () => {
      const cached = await this.idempotencyStore!.get(scopedKey);
      if (cached) return cached.withReplay();
      const claimStore = isClaimStore(this.idempotencyStore!) ? this.idempotencyStore : null;
      if (claimStore && !(await claimStore.claim(scopedKey))) {
        const claimed = await claimStore.get(scopedKey);
        return claimed?.withReplay() ?? AutomationActionResult.failure(
          "The action idempotency key is already being processed",
          { metadata: { deliveryStatus: "ambiguous" } },
        );
      }
      const result = await this.invoke(registered.handler, request);
      if (result.ok || !result.retryable) await this.idempotencyStore!.put(scopedKey, result);
      else if (claimStore) await claimStore.release(scopedKey);
      return result;
    });
  }

  contractSnapshot(): Record<string, unknown> {
    return { actions: this.actionDefinitions, events: this.eventDefinitions };
  }

  private async invoke(handler: AutomationActionHandler, request: AutomationActionRequest): Promise<AutomationActionResult> {
    try {
      const value = await handler(request);
      if (value instanceof AutomationActionResult) return value;
      if (value === undefined) return AutomationActionResult.success();
      if (isRecord(value)) return AutomationActionResult.success(value);
      return AutomationActionResult.failure("Automation handler returned an unsupported result type");
    } catch (error) {
      return AutomationActionResult.failure(error instanceof Error ? error.message : String(error));
    }
  }

  private async withKeyLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    let queue = this.keyQueues.get(key);
    if (!queue) {
      queue = { tail: Promise.resolve(), pending: 0 };
      this.keyQueues.set(key, queue);
    }
    const previous = queue.tail;
    let release = (): void => {};
    queue.tail = new Promise<void>((resolve) => { release = resolve; });
    queue.pending += 1;
    await previous;
    try {
      return await operation();
    } finally {
      release();
      queue.pending -= 1;
      if (queue.pending === 0) this.keyQueues.delete(key);
    }
  }
}

export class AutomationClient {
  constructor(
    readonly options: {
      eventClient: EventClient;
      authContext: RuntimeAuthContext;
      registry?: AutomationRegistry;
    },
  ) {}

  async emit(values: {
    eventType: string;
    device: RuntimeDeviceRef | (Record<string, unknown> & { id?: string });
    data?: Record<string, unknown>;
    source?: string;
    severity?: "info" | "warning" | "error" | "critical";
    eventId?: string;
  }): Promise<void> {
    if (this.options.registry && !this.options.registry.eventDefinitions.some((item) => item.eventType === values.eventType)) {
      throw new TypeError(`Automation event '${values.eventType}' is not registered`);
    }
    await this.options.eventClient.sendDeviceEvent({
      authContext: this.options.authContext,
      device: values.device,
      eventType: values.eventType,
      ...(values.data ? { payload: values.data } : {}),
      ...(values.source ? { source: values.source } : {}),
      ...(values.severity ? { severity: values.severity } : {}),
      ...(values.eventId ? { eventId: values.eventId } : {}),
    });
  }
}

export function buildMockAutomationEvent(values: {
  eventType: string;
  data?: Record<string, unknown>;
  integrationId?: string;
  configId?: string;
  containerId?: string;
  deviceId?: string;
  eventId?: string;
}) {
  return buildCoreEventPayload({
    eventType: values.eventType,
    integrationId: values.integrationId ?? "mock-integration",
    configId: values.configId ?? "mock-config",
    containerId: values.containerId ?? "mock-container",
    deviceId: values.deviceId ?? "mock-device",
    payload: values.data ?? {},
    source: "automation-sdk-mock",
    ...(values.eventId ? { eventId: values.eventId } : {}),
  });
}

export function auditBehaviorsContract(
  behaviors: Record<string, unknown>,
  registry: AutomationRegistry,
): AutomationContractReport {
  const declaredActions = new Set<string>();
  const declaredEvents = new Set<string>();
  for (const device of Array.isArray(behaviors.devices) ? behaviors.devices : []) {
    if (!isRecord(device)) continue;
    for (const action of Array.isArray(device.actions) ? device.actions : []) {
      if (isRecord(action) && isRecord(action.runtime) && typeof action.runtime.command === "string") {
        declaredActions.add(action.runtime.command.trim());
      }
    }
    for (const trigger of Array.isArray(device.triggers) ? device.triggers : []) {
      if (isRecord(trigger) && isRecord(trigger.runtime)) {
        if (typeof trigger.runtime.event === "string") declaredEvents.add(trigger.runtime.event.trim());
        for (const eventType of Array.isArray(trigger.runtime.events) ? trigger.runtime.events : []) {
          if (typeof eventType === "string") declaredEvents.add(eventType.trim());
        }
      }
    }
  }
  const registeredActions = new Set(registry.actionDefinitions.map((item) => item.command));
  const registeredEvents = new Set(registry.eventDefinitions.map((item) => item.eventType));
  const missingActionHandlers = difference(declaredActions, registeredActions);
  const missingEventPublishers = difference(declaredEvents, registeredEvents);
  const undeclaredActionHandlers = difference(registeredActions, declaredActions);
  const undeclaredEventPublishers = difference(registeredEvents, declaredEvents);
  const messages = [
    formatIssue("Missing action handlers", missingActionHandlers),
    formatIssue("Missing event publishers", missingEventPublishers),
    formatIssue("Handlers absent from behaviors.json", undeclaredActionHandlers),
    formatIssue("Events absent from behaviors.json", undeclaredEventPublishers),
  ].filter((value): value is string => Boolean(value));
  return {
    ok: messages.length === 0,
    missingActionHandlers,
    missingEventPublishers,
    undeclaredActionHandlers,
    undeclaredEventPublishers,
    messages,
  };
}

export function assertBehaviorsContract(behaviors: Record<string, unknown>, registry: AutomationRegistry): void {
  const report = auditBehaviorsContract(behaviors, registry);
  if (!report.ok) throw new TypeError(report.messages.join("; "));
}

export function normalizeAutomationActionRequest(
  value: AutomationActionRequest | Record<string, unknown>,
  idempotencyKey?: string | null,
): AutomationActionRequest {
  const command = typeof value.command === "string" ? value.command.trim() : "";
  if (!command) throw new TypeError("Automation action command cannot be empty");
  const normalizedKey = idempotencyKey?.trim() || readOptionalString(value, "idempotencyKey", "idempotency_key");
  return {
    ...value,
    command,
    args: isRecord(value.args) ? value.args : {},
    ...(normalizedKey ? { idempotencyKey: normalizedKey } : {}),
    ...copyAliasedStrings(value),
  };
}

function copyAliasedStrings(value: Record<string, unknown>): Partial<AutomationActionRequest> {
  const aliases: Array<[keyof AutomationActionRequest, string, string]> = [
    ["commandId", "commandId", "command_id"], ["correlationId", "correlationId", "correlation_id"],
    ["integrationId", "integrationId", "integration_id"], ["configId", "configId", "config_id"],
    ["containerId", "containerId", "container_id"], ["deviceId", "deviceId", "device_id"],
    ["entityId", "entityId", "entity_id"], ["capabilityId", "capabilityId", "capability_id"],
    ["runId", "runId", "run_id"], ["nodeId", "nodeId", "node_id"],
  ];
  const result: Partial<AutomationActionRequest> = {};
  for (const [key, camel, snake] of aliases) {
    const item = readOptionalString(value, camel, snake);
    if (item) Object.assign(result, { [key]: item });
  }
  return result;
}

function readOptionalString(value: Record<string, unknown>, camel: string, snake: string): string | undefined {
  const candidate = value[camel] ?? value[snake];
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isClaimStore(store: AutomationIdempotencyStore): store is AutomationIdempotencyClaimStore {
  const value = store as Partial<AutomationIdempotencyClaimStore>;
  return typeof value.claim === "function" && typeof value.release === "function";
}

function isNodeError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && "code" in error;
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((item) => item && !right.has(item)).sort();
}

function formatIssue(label: string, values: string[]): string | null {
  return values.length ? `${label}: ${values.join(", ")}` : null;
}
