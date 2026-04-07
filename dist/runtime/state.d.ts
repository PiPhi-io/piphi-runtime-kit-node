/**
 * Minimal mutable process state shared across a runtime instance.
 */
export declare class RuntimeProcessState {
    currentGeneration: number | null;
    backgroundTasks: Set<Promise<unknown>>;
    coreBaseUrl: string;
    coreFetch: typeof fetch | null;
    /**
     * Bind a shared fetch implementation for calls back to PiPhi Core.
     */
    setCoreFetch(coreFetch: typeof fetch): void;
    /**
     * Set the latest config generation applied by snapshot sync.
     */
    setCurrentGeneration(generation: number | null): void;
}
