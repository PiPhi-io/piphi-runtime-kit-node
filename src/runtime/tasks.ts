import { RuntimeProcessState } from "./state.js";

export class BackgroundTaskLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackgroundTaskLimitError";
  }
}

export type BackgroundTaskFactory<T> = (signal: AbortSignal) => Promise<T>;

function backgroundTaskAbortError(): Error {
  const error = new Error("background task was aborted before it started");
  error.name = "AbortError";
  return error;
}

function rejectBackgroundWork(processState: RuntimeProcessState): never {
  processState.backgroundTaskRejectedCount += 1;
  throw new BackgroundTaskLimitError(
    `runtime background task limit reached (${processState.maxBackgroundTasks}); ` +
      "apply backpressure or reduce delivery rate",
  );
}

function assertBackgroundCapacity(processState: RuntimeProcessState): void {
  if (processState.backgroundTasks.size >= processState.maxBackgroundTasks) {
    rejectBackgroundWork(processState);
  }
}

/**
 * Track one background promise until it settles.
 */
export function trackBackgroundTask<T>(
  processState: RuntimeProcessState,
  task: Promise<T>,
  controller?: AbortController,
): Promise<T> {
  assertBackgroundCapacity(processState);
  processState.backgroundTasks.add(task);
  if (controller !== undefined) processState.backgroundTaskControllers.set(task, controller);
  task.then(
    () => {
      processState.backgroundTasks.delete(task);
      processState.backgroundTaskControllers.delete(task);
    },
    (error: unknown) => {
      if (!(error instanceof Error && error.name === "AbortError")) {
        processState.backgroundTaskFailureCount += 1;
      }
      processState.backgroundTasks.delete(task);
      processState.backgroundTaskControllers.delete(task);
    },
  );
  return task;
}

/**
 * Alias for trackBackgroundTask to match the Python kit naming.
 */
export function createTrackedTask<T>(
  processState: RuntimeProcessState,
  taskOrFactory: Promise<T> | BackgroundTaskFactory<T>,
): Promise<T> {
  assertBackgroundCapacity(processState);
  if (typeof taskOrFactory !== "function") return trackBackgroundTask(processState, taskOrFactory);
  const controller = new AbortController();
  const task = Promise.resolve().then(() => {
    if (controller.signal.aborted) throw backgroundTaskAbortError();
    return taskOrFactory(controller.signal);
  });
  return trackBackgroundTask(processState, task, controller);
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

export async function shutdownBackgroundTasks(
  processState: RuntimeProcessState,
  options: { gracePeriodMs?: number } = {},
): Promise<void> {
  const gracePeriodMs = options.gracePeriodMs ?? 5_000;
  if (!Number.isFinite(gracePeriodMs) || gracePeriodMs < 0) {
    throw new RangeError("gracePeriodMs cannot be negative");
  }
  const pending = Array.from(processState.backgroundTasks);
  if (pending.length === 0) return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (gracePeriodMs > 0) {
    await Promise.race([
      Promise.allSettled(pending),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, gracePeriodMs); }),
    ]);
  }
  if (timer !== undefined) clearTimeout(timer);
  const abortableTasks: Promise<unknown>[] = [];
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
