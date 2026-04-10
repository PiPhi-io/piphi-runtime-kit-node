import { RuntimeProcessState } from "./state.js";

/**
 * Track one background promise until it settles.
 */
export function trackBackgroundTask<T>(
  processState: RuntimeProcessState,
  task: Promise<T>,
): Promise<T> {
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
export function createTrackedTask<T>(
  processState: RuntimeProcessState,
  task: Promise<T>,
): Promise<T> {
  return trackBackgroundTask(processState, task);
}

/**
 * Await all currently pending tracked tasks.
 */
export async function awaitPendingBackgroundTasks(
  processState: RuntimeProcessState,
): Promise<void> {
  const pending = Array.from(processState.backgroundTasks);
  await Promise.allSettled(pending);
}
