import { RuntimeRegistry, type RuntimeRegistryEntry } from "./registry.js";
export type StateReader = () => void | Promise<void>;
export interface StateRefreshReceipt {
    request_id: string;
    performed: boolean;
    status: "refreshed" | "unsupported" | "failed";
    observed_at?: string;
    source?: string;
    message?: string;
    error?: string;
}
/** Minimal state API for publishing cache updates and proving upstream refreshes. */
export declare class RuntimeStateService<TState extends Record<string, unknown> = Record<string, unknown>, TEntry extends RuntimeRegistryEntry<TState> = RuntimeRegistryEntry<TState>, TEvent extends Record<string, unknown> = Record<string, unknown>> {
    private readonly registry;
    private reader?;
    private source?;
    private timeoutMs;
    constructor(registry: RuntimeRegistry<TState, TEntry, TEvent>);
    provide(reader: StateReader, options: {
        source: string;
        timeoutMs?: number;
    }): void;
    publish(entryId: string, state: TState, deviceId?: string): {
        deviceId: string;
        state: TState;
        lastUpdated: string;
    };
    get(entryId: string): {
        state: TState;
        deviceId: string;
        lastUpdated: string;
    } | undefined;
    response(options?: {
        refresh?: boolean;
        refreshRequestId?: string;
    }): Promise<Record<string, unknown>>;
    private refresh;
    private entriesResponse;
}
