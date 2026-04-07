/**
 * Small in-memory registry for active runtime entries, latest state, and recent events.
 */
export type RuntimeRegistryEntry<TState extends object> = {
    latestState?: TState;
    lastUpdated?: string;
};
export declare class RuntimeRegistry<TState extends object = Record<string, unknown>, TEntry extends RuntimeRegistryEntry<TState> = RuntimeRegistryEntry<TState>, TEvent extends object = Record<string, unknown>> {
    readonly maxRecentEvents: number;
    readonly entries: Map<string, TEntry>;
    readonly stateSnapshots: Map<string, {
        deviceId: string;
        state: TState;
        lastUpdated: string;
    }>;
    readonly recentEvents: TEvent[];
    constructor(maxRecentEvents?: number);
    get(entryId: string): TEntry | undefined;
    set(entryId: string, entry: TEntry): TEntry;
    remove(entryId: string): TEntry | undefined;
    ids(): string[];
    primaryEntry(): TEntry | undefined;
    updateState(entryId: string, state: TState): {
        deviceId: string;
        state: TState;
        lastUpdated: string;
    };
    appendEvent(event: TEvent): TEvent;
}
