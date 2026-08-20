import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCoreEventPayload } from "./runtime/events.js";
export class AutomationActionResult {
    status;
    result;
    error;
    retryable;
    metadata;
    replayed;
    constructor(values) {
        this.status = values.status;
        this.result = { ...(values.result ?? {}) };
        this.error = values.error ?? null;
        this.retryable = values.retryable ?? false;
        this.metadata = { ...(values.metadata ?? {}) };
        this.replayed = values.replayed ?? false;
    }
    get ok() {
        return this.status === "success";
    }
    static success(result = {}) {
        return new AutomationActionResult({ status: "success", result });
    }
    static failure(error, options = {}) {
        return new AutomationActionResult({
            status: "failed",
            error,
            ...(options.retryable !== undefined ? { retryable: options.retryable } : {}),
            ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
        });
    }
    withReplay() {
        return new AutomationActionResult({
            status: this.status,
            result: this.result,
            error: this.error,
            retryable: this.retryable,
            metadata: this.metadata,
            replayed: true,
        });
    }
    toJSON() {
        return {
            status: this.status,
            result: this.result,
            error: this.error,
            retryable: this.retryable,
            metadata: this.metadata,
            replayed: this.replayed,
        };
    }
    static from(value) {
        if (value instanceof AutomationActionResult)
            return value;
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
export class InMemoryAutomationIdempotencyStore {
    results = new Map();
    async get(key) {
        const result = this.results.get(key);
        return result ? AutomationActionResult.from(result.toJSON()) : null;
    }
    async put(key, result) {
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
export class FileAutomationIdempotencyStore {
    directory;
    constructor(directory) {
        this.directory = path.resolve(directory);
    }
    recordPath(key) {
        const digest = createHash("sha256").update(key).digest("hex");
        return path.join(this.directory, `${digest}.json`);
    }
    async claim(key) {
        await mkdir(this.directory, { recursive: true });
        let handle;
        try {
            handle = await open(this.recordPath(key), "wx", 0o600);
            await handle.writeFile(JSON.stringify({ status: "dispatching", updatedAt: new Date().toISOString() }));
            return true;
        }
        catch (error) {
            if (isNodeError(error) && error.code === "EEXIST")
                return false;
            throw error;
        }
        finally {
            await handle?.close();
        }
    }
    async get(key) {
        let parsed;
        try {
            parsed = JSON.parse(await readFile(this.recordPath(key), "utf8"));
        }
        catch (error) {
            if (isNodeError(error) && error.code === "ENOENT")
                return null;
            throw error;
        }
        if (!isRecord(parsed))
            return null;
        if (parsed.status === "dispatching") {
            return AutomationActionResult.failure("An earlier action attempt may still have reached the device; manual review is required", { retryable: false, metadata: { deliveryStatus: "ambiguous" } });
        }
        return parsed.status === "terminal" ? AutomationActionResult.from(parsed.result) : null;
    }
    async put(key, result) {
        await mkdir(this.directory, { recursive: true });
        const recordPath = this.recordPath(key);
        const temporaryPath = `${recordPath}.${randomUUID()}.tmp`;
        await writeFile(temporaryPath, JSON.stringify({ status: "terminal", result: result.toJSON(), updatedAt: new Date().toISOString() }), { mode: 0o600 });
        await rename(temporaryPath, recordPath);
    }
    async release(key) {
        const recordPath = this.recordPath(key);
        try {
            const parsed = JSON.parse(await readFile(recordPath, "utf8"));
            if (isRecord(parsed) && parsed.status === "dispatching") {
                await rm(recordPath, { force: true });
            }
        }
        catch (error) {
            if (isNodeError(error) && error.code === "ENOENT")
                return;
            throw error;
        }
    }
}
export class AutomationRegistry {
    idempotencyStore;
    actions = new Map();
    events = new Map();
    keyQueues = new Map();
    constructor(options = {}) {
        this.idempotencyStore = options.idempotencyStore;
    }
    get actionDefinitions() {
        return [...this.actions.values()].map(({ definition }) => ({ ...definition }));
    }
    get eventDefinitions() {
        return [...this.events.values()].map((definition) => ({ ...definition }));
    }
    action(command, options = {}) {
        const normalized = command.trim();
        if (!normalized)
            throw new TypeError("Automation action command cannot be empty");
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
    event(eventType, options = {}) {
        const normalized = eventType.trim();
        if (!normalized)
            throw new TypeError("Automation event type cannot be empty");
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
    async dispatch(requestValue, options = {}) {
        const request = normalizeAutomationActionRequest(requestValue, options.idempotencyKey);
        const registered = this.actions.get(request.command);
        if (!registered) {
            return AutomationActionResult.failure(`Unknown automation action '${request.command}'`);
        }
        const scopedKey = request.idempotencyKey ? `${request.command}:${request.idempotencyKey}` : "";
        if (!scopedKey || !this.idempotencyStore)
            return this.invoke(registered.handler, request);
        return this.withKeyLock(scopedKey, async () => {
            const cached = await this.idempotencyStore.get(scopedKey);
            if (cached)
                return cached.withReplay();
            const claimStore = isClaimStore(this.idempotencyStore) ? this.idempotencyStore : null;
            if (claimStore && !(await claimStore.claim(scopedKey))) {
                const claimed = await claimStore.get(scopedKey);
                return claimed?.withReplay() ?? AutomationActionResult.failure("The action idempotency key is already being processed", { metadata: { deliveryStatus: "ambiguous" } });
            }
            const result = await this.invoke(registered.handler, request);
            if (result.ok || !result.retryable)
                await this.idempotencyStore.put(scopedKey, result);
            else if (claimStore)
                await claimStore.release(scopedKey);
            return result;
        });
    }
    contractSnapshot() {
        return { actions: this.actionDefinitions, events: this.eventDefinitions };
    }
    async invoke(handler, request) {
        try {
            const value = await handler(request);
            if (value instanceof AutomationActionResult)
                return value;
            if (value === undefined)
                return AutomationActionResult.success();
            if (isRecord(value))
                return AutomationActionResult.success(value);
            return AutomationActionResult.failure("Automation handler returned an unsupported result type");
        }
        catch (error) {
            return AutomationActionResult.failure(error instanceof Error ? error.message : String(error));
        }
    }
    async withKeyLock(key, operation) {
        let queue = this.keyQueues.get(key);
        if (!queue) {
            queue = { tail: Promise.resolve(), pending: 0 };
            this.keyQueues.set(key, queue);
        }
        const previous = queue.tail;
        let release = () => { };
        queue.tail = new Promise((resolve) => { release = resolve; });
        queue.pending += 1;
        await previous;
        try {
            return await operation();
        }
        finally {
            release();
            queue.pending -= 1;
            if (queue.pending === 0)
                this.keyQueues.delete(key);
        }
    }
}
export class AutomationClient {
    options;
    constructor(options) {
        this.options = options;
    }
    async emit(values) {
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
export function buildMockAutomationEvent(values) {
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
export function auditBehaviorsContract(behaviors, registry) {
    const declaredActions = new Set();
    const declaredEvents = new Set();
    for (const device of Array.isArray(behaviors.devices) ? behaviors.devices : []) {
        if (!isRecord(device))
            continue;
        for (const action of Array.isArray(device.actions) ? device.actions : []) {
            if (isRecord(action) && isRecord(action.runtime) && typeof action.runtime.command === "string") {
                declaredActions.add(action.runtime.command.trim());
            }
        }
        for (const trigger of Array.isArray(device.triggers) ? device.triggers : []) {
            if (isRecord(trigger) && isRecord(trigger.runtime)) {
                if (typeof trigger.runtime.event === "string")
                    declaredEvents.add(trigger.runtime.event.trim());
                for (const eventType of Array.isArray(trigger.runtime.events) ? trigger.runtime.events : []) {
                    if (typeof eventType === "string")
                        declaredEvents.add(eventType.trim());
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
    ].filter((value) => Boolean(value));
    return {
        ok: messages.length === 0,
        missingActionHandlers,
        missingEventPublishers,
        undeclaredActionHandlers,
        undeclaredEventPublishers,
        messages,
    };
}
export function assertBehaviorsContract(behaviors, registry) {
    const report = auditBehaviorsContract(behaviors, registry);
    if (!report.ok)
        throw new TypeError(report.messages.join("; "));
}
export function normalizeAutomationActionRequest(value, idempotencyKey) {
    const command = typeof value.command === "string" ? value.command.trim() : "";
    if (!command)
        throw new TypeError("Automation action command cannot be empty");
    const normalizedKey = idempotencyKey?.trim() || readOptionalString(value, "idempotencyKey", "idempotency_key");
    return {
        ...value,
        command,
        args: isRecord(value.args) ? value.args : {},
        ...(normalizedKey ? { idempotencyKey: normalizedKey } : {}),
        ...copyAliasedStrings(value),
    };
}
function copyAliasedStrings(value) {
    const aliases = [
        ["commandId", "commandId", "command_id"], ["correlationId", "correlationId", "correlation_id"],
        ["integrationId", "integrationId", "integration_id"], ["configId", "configId", "config_id"],
        ["containerId", "containerId", "container_id"], ["deviceId", "deviceId", "device_id"],
        ["entityId", "entityId", "entity_id"], ["capabilityId", "capabilityId", "capability_id"],
        ["runId", "runId", "run_id"], ["nodeId", "nodeId", "node_id"],
    ];
    const result = {};
    for (const [key, camel, snake] of aliases) {
        const item = readOptionalString(value, camel, snake);
        if (item)
            Object.assign(result, { [key]: item });
    }
    return result;
}
function readOptionalString(value, camel, snake) {
    const candidate = value[camel] ?? value[snake];
    return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isClaimStore(store) {
    const value = store;
    return typeof value.claim === "function" && typeof value.release === "function";
}
function isNodeError(error) {
    return error instanceof Error && "code" in error;
}
function difference(left, right) {
    return [...left].filter((item) => item && !right.has(item)).sort();
}
function formatIssue(label, values) {
    return values.length ? `${label}: ${values.join(", ")}` : null;
}
