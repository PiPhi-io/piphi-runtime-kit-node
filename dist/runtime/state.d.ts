/**
 * Minimal mutable process state shared across a runtime instance.
 */
export declare class RuntimeProcessState {
    currentGeneration: number | null;
    backgroundTasks: Set<Promise<unknown>>;
    backgroundTaskControllers: Map<Promise<unknown>, AbortController>;
    maxBackgroundTasks: number;
    backgroundTaskFailureCount: number;
    backgroundTaskRejectedCount: number;
    coreBaseUrl: string;
    coreFetch: typeof fetch | null;
    constructor(options?: {
        maxBackgroundTasks?: number;
        coreBaseUrl?: string;
    });
    /**
     * Bind a shared fetch implementation for calls back to PiPhi Core.
     */
    setCoreFetch(coreFetch: typeof fetch | null): void;
    /**
     * Set the latest config generation applied by snapshot sync.
     */
    setCurrentGeneration(generation: number | null): void;
}
