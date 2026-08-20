export class BackgroundTaskLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = "BackgroundTaskLimitError";
    }
}
function backgroundTaskAbortError() {
    const error = new Error("background task was aborted before it started");
    error.name = "AbortError";
    return error;
}
function rejectBackgroundWork(processState) {
    processState.backgroundTaskRejectedCount += 1;
    throw new BackgroundTaskLimitError(`runtime background task limit reached (${processState.maxBackgroundTasks}); ` +
        "apply backpressure or reduce delivery rate");
}
function assertBackgroundCapacity(processState) {
    if (processState.backgroundTasks.size >= processState.maxBackgroundTasks) {
        rejectBackgroundWork(processState);
    }
}
/**
 * Track one background promise until it settles.
 */
export function trackBackgroundTask(processState, task, controller) {
    assertBackgroundCapacity(processState);
    processState.backgroundTasks.add(task);
    if (controller !== undefined)
        processState.backgroundTaskControllers.set(task, controller);
    task.then(() => {
        processState.backgroundTasks.delete(task);
        processState.backgroundTaskControllers.delete(task);
    }, (error) => {
        if (!(error instanceof Error && error.name === "AbortError")) {
            processState.backgroundTaskFailureCount += 1;
        }
        processState.backgroundTasks.delete(task);
        processState.backgroundTaskControllers.delete(task);
    });
    return task;
}
/**
 * Alias for trackBackgroundTask to match the Python kit naming.
 */
export function createTrackedTask(processState, taskOrFactory) {
    assertBackgroundCapacity(processState);
    if (typeof taskOrFactory !== "function")
        return trackBackgroundTask(processState, taskOrFactory);
    const controller = new AbortController();
    const task = Promise.resolve().then(() => {
        if (controller.signal.aborted)
            throw backgroundTaskAbortError();
        return taskOrFactory(controller.signal);
    });
    return trackBackgroundTask(processState, task, controller);
}
/**
 * Await all currently pending tracked tasks.
 */
export async function awaitPendingBackgroundTasks(processState) {
    const pending = Array.from(processState.backgroundTasks);
    await Promise.allSettled(pending);
}
export async function shutdownBackgroundTasks(processState, options = {}) {
    const gracePeriodMs = options.gracePeriodMs ?? 5_000;
    if (!Number.isFinite(gracePeriodMs) || gracePeriodMs < 0) {
        throw new RangeError("gracePeriodMs cannot be negative");
    }
    const pending = Array.from(processState.backgroundTasks);
    if (pending.length === 0)
        return;
    let timer;
    if (gracePeriodMs > 0) {
        await Promise.race([
            Promise.allSettled(pending),
            new Promise((resolve) => { timer = setTimeout(resolve, gracePeriodMs); }),
        ]);
    }
    if (timer !== undefined)
        clearTimeout(timer);
    const abortableTasks = [];
    for (const task of Array.from(processState.backgroundTasks)) {
        const controller = processState.backgroundTaskControllers.get(task);
        if (controller !== undefined) {
            abortableTasks.push(task);
            controller.abort();
        }
    }
    await Promise.allSettled(abortableTasks);
}
export const shutdown_background_tasks = shutdownBackgroundTasks;
