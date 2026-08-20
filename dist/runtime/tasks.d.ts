import { RuntimeProcessState } from "./state.js";
export declare class BackgroundTaskLimitError extends Error {
    constructor(message: string);
}
export type BackgroundTaskFactory<T> = (signal: AbortSignal) => Promise<T>;
/**
 * Track one background promise until it settles.
 */
export declare function trackBackgroundTask<T>(processState: RuntimeProcessState, task: Promise<T>, controller?: AbortController): Promise<T>;
/**
 * Alias for trackBackgroundTask to match the Python kit naming.
 */
export declare function createTrackedTask<T>(processState: RuntimeProcessState, taskOrFactory: Promise<T> | BackgroundTaskFactory<T>): Promise<T>;
/**
 * Await all currently pending tracked tasks.
 */
export declare function awaitPendingBackgroundTasks(processState: RuntimeProcessState): Promise<void>;
export declare function shutdownBackgroundTasks(processState: RuntimeProcessState, options?: {
    gracePeriodMs?: number;
}): Promise<void>;
export declare const shutdown_background_tasks: typeof shutdownBackgroundTasks;
