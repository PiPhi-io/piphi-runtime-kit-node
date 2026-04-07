import { RuntimeProcessState } from "./state.js";
/**
 * Track one background promise until it settles.
 */
export declare function trackBackgroundTask<T>(processState: RuntimeProcessState, task: Promise<T>): Promise<T>;
/**
 * Alias for trackBackgroundTask to match the Python kit naming.
 */
export declare function createTrackedTask<T>(processState: RuntimeProcessState, task: Promise<T>): Promise<T>;
/**
 * Await all currently pending tracked tasks.
 */
export declare function awaitPendingBackgroundTasks(processState: RuntimeProcessState): Promise<void>;
