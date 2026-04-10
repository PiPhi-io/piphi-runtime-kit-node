/**
 * Track one background promise until it settles.
 */
export function trackBackgroundTask(processState, task) {
    processState.backgroundTasks.add(task);
    task.then(() => {
        processState.backgroundTasks.delete(task);
    }, () => {
        processState.backgroundTasks.delete(task);
    });
    return task;
}
/**
 * Alias for trackBackgroundTask to match the Python kit naming.
 */
export function createTrackedTask(processState, task) {
    return trackBackgroundTask(processState, task);
}
/**
 * Await all currently pending tracked tasks.
 */
export async function awaitPendingBackgroundTasks(processState) {
    const pending = Array.from(processState.backgroundTasks);
    await Promise.allSettled(pending);
}
